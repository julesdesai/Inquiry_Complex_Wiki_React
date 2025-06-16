import os
import time
import logging
import asyncio
import random
import re
from typing import Dict, List, Tuple, Optional, Literal, Union
from openai import OpenAI, AsyncOpenAI, RateLimitError
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Constants for rate limiting
class RateLimiter:
    def __init__(self, tokens_per_min=1980000, buffer=0.98):
        """Initialize rate limiter with tokens per minute and safety buffer
        Uses a higher buffer (0.98) to maximize throughput while avoiding limits"""
        self.max_tokens = tokens_per_min * buffer  # Apply safety buffer
        self.tokens_used = 0
        self.last_reset = time.time()
        self.reset_interval = 60  # Reset counter every minute
        self.lock = asyncio.Lock()
        self.is_rate_limited = False
        self.rate_limited_until = 0
        
    async def add_tokens(self, tokens: int) -> None:
        """Add tokens to usage counter with bounds checking"""
        async with self.lock:
            # Check if we need to reset the counter
            current_time = time.time()
            if current_time - self.last_reset >= self.reset_interval:
                self.tokens_used = 0
                self.last_reset = current_time
            
            self.tokens_used += tokens
    
    async def check_rate_limit(self, estimated_tokens: int) -> Tuple[bool, float]:
        """Check if request would exceed rate limit
        Returns: (can_proceed, wait_time_seconds)"""
        async with self.lock:
            current_time = time.time()
            
            # If we're currently rate limited, check if the timeout has passed
            if self.is_rate_limited and current_time < self.rate_limited_until:
                wait_time = self.rate_limited_until - current_time
                return False, wait_time
            else:
                self.is_rate_limited = False
            
            # Reset counter if interval passed
            if current_time - self.last_reset >= self.reset_interval:
                self.tokens_used = 0
                self.last_reset = current_time
            
            # Check if we have enough token capacity - skip this when below 80% usage
            if self.tokens_used > self.max_tokens * 0.8 and self.tokens_used + estimated_tokens > self.max_tokens:
                # Calculate time until reset
                time_until_reset = self.reset_interval - (current_time - self.last_reset)
                return False, max(0.05, time_until_reset)  # Reduced minimum wait time
            
            return True, 0
            
    def mark_rate_limited(self, retry_after: float) -> None:
        """Mark that we've been rate limited and should pause"""
        self.is_rate_limited = True
        self.rate_limited_until = time.time() + retry_after

# Provider configurations
PROVIDERS = {
    "openai": {
        "base_url": None,  # Default OpenAI URL
        "models": {
            "gpt-4o": {
                "temp_range": (0.0, 1.0),
                "avg_tokens_per_char": 0.5,  # Estimation factor for input tokens
                "rate_limiter": RateLimiter(tokens_per_min=2000000, buffer=0.98)
            },
            # Add other OpenAI models as needed
        }
    },
    "deepseek": {
        "base_url": "https://api.deepseek.com",
        "models": {
            "deepseek-reasoner": {"temp_range": (0.0, 1.0)},
            "deepseek-chat": {"temp_range": (0.0, 1.0)},
            # Add other Deepseek models as needed
        }
    }
}


PROMPT_FILES = {
    "thesis": "thesis_prompt.txt",
    "reasons": "reasons_prompt.txt",
    "antithesis": "antithesis_prompt.txt",
    "direct_reply": "direct_reply_prompt.txt",
    "synthesis": "synthesis_prompt.txt",
    "view_identity": "view_identity_prompt.txt",
    "nonsense": "nonsense_prompt.txt"
}

# Load environment variables
load_dotenv()
openai_api_key = os.getenv('OPENAI_API_KEY')
deepseek_api_key = os.getenv('DEEPSEEK_API_KEY')

# Set up clients for different providers
clients = {}
async_clients = {}

# Initialize clients if keys are available
if openai_api_key:
    clients["openai"] = OpenAI(api_key=openai_api_key)
    async_clients["openai"] = AsyncOpenAI(api_key=openai_api_key)

if deepseek_api_key:
    clients["deepseek"] = OpenAI(api_key=deepseek_api_key, base_url=PROVIDERS["deepseek"]["base_url"])
    async_clients["deepseek"] = AsyncOpenAI(api_key=deepseek_api_key, base_url=PROVIDERS["deepseek"]["base_url"])

# Default model and provider
default_model = "gpt-4o"
default_provider = "openai"

def get_provider_for_model(model_name: str) -> str:
    """Determine which provider to use for a given model"""
    for provider, config in PROVIDERS.items():
        if model_name in config["models"]:
            return provider
    raise ValueError(f"Unknown model: {model_name}")

def load_prompts(prompt_dir: str) -> Dict[str, str]:
    """Load all prompt templates from files"""
    prompts = {}
    try:
        for prompt_type, filename in PROMPT_FILES.items():
            file_path = os.path.join(prompt_dir, filename)
            with open(file_path, 'r') as file:
                prompts[prompt_type] = file.read().strip()
        return prompts
    except Exception as e:
        raise Exception(f"Error loading prompts: {e}")

def estimate_tokens(text: str, avg_tokens_per_char: float = 0.5) -> int:
    """Roughly estimate number of tokens based on text length"""
    return int(len(text) * avg_tokens_per_char)

# Extract rate limit retry time from OpenAI error message
def parse_retry_time_from_error(error_message: str) -> float:
    """Extract retry time in seconds from OpenAI error message"""
    try:
        match = re.search(r'Please try again in (\d+)ms', error_message)
        if match:
            ms = int(match.group(1))
            return ms / 1000.0 + 0.05  # Convert to seconds and add small buffer
    except:
        pass
    return 1.0  # Default to 1 second if parsing fails

def calculate_backoff(attempt: int, base_delay: float = 1.0, max_delay: float = 60.0, jitter: float = 0.1) -> float:
    """Calculate exponential backoff with jitter"""
    # Exponential backoff: base_delay * 2^attempt with max cap
    delay = min(base_delay * (2 ** attempt), max_delay)
    # Add jitter: randomly adjust by ±10%
    jitter_amount = delay * jitter
    return delay + random.uniform(-jitter_amount, jitter_amount)

def generate_completion(prompt: str, system_role: str = "", model: str = None, 
                        temperature: float = 0.7, top_p: float = 0.3) -> str:
    """Generate a completion with error handling, timeout, and smart retry logic"""
    # Use default model if none specified
    model = model or default_model
    
    # Determine provider based on model
    provider = get_provider_for_model(model)
    
    # Ensure we have a client for this provider
    if provider not in clients:
        available_providers = ", ".join(clients.keys())
        raise ValueError(f"No API key configured for provider '{provider}'. Available providers: {available_providers}")
    
    client = clients[provider]
    
    max_retries = 5  # More retries with smarter backoff
    retry_count = 0
    
    # For synchronous calls, we still use asyncio.run to leverage the rate limiter, but only for large prompts
    if provider == "openai" and model in PROVIDERS["openai"]["models"] and len(prompt) > 1000:
        # Check with rate limiter before making the call
        rate_limiter = PROVIDERS["openai"]["models"][model].get("rate_limiter")
        if rate_limiter:
            # Estimate tokens (very rough approximation)
            tokens_estimate = estimate_tokens(prompt + system_role)
            
            # Run this in an event loop
            can_proceed, wait_time = asyncio.run(rate_limiter.check_rate_limit(tokens_estimate))
            if not can_proceed:
                logging.info(f"Rate limit proactively avoided. Waiting {wait_time:.2f}s before proceeding.")
                time.sleep(wait_time)
    
    while retry_count <= max_retries:
        try:
            response = client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_role},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                top_p=top_p,
                timeout=30  # Add 30-second timeout to prevent hanging
            )
            
            # Record tokens used if we have a rate limiter for this model
            if provider == "openai" and model in PROVIDERS["openai"]["models"]:
                rate_limiter = PROVIDERS["openai"]["models"][model].get("rate_limiter")
                if rate_limiter and hasattr(response, 'usage') and response.usage:
                    # For synchronous calls, we still use asyncio for the rate limiter
                    total_tokens = response.usage.total_tokens
                    asyncio.run(rate_limiter.add_tokens(total_tokens))
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            error_str = str(e)
            
            # Special handling for rate limit errors
            if "rate_limit_exceeded" in error_str or "Rate limit" in error_str:
                # Parse retry time from error message if available
                retry_time = parse_retry_time_from_error(error_str)
                
                # If we got a specific retry time, use it (with minimal buffer)
                if retry_time > 0:
                    retry_delay = retry_time + 0.05  # Add 50ms buffer (reduced)
                else:
                    # Otherwise use minimal backoff for rate limits
                    retry_delay = 0.1 * (retry_count + 1)  # Linear backoff starting at 100ms
                
                # Update rate limiter if we have one
                if provider == "openai" and model in PROVIDERS["openai"]["models"]:
                    rate_limiter = PROVIDERS["openai"]["models"][model].get("rate_limiter")
                    if rate_limiter:
                        # Use asyncio to call the rate limiter
                        asyncio.run(rate_limiter.mark_rate_limited(retry_delay))
                
                logging.warning(f"Rate limit hit. Waiting {retry_delay:.2f}s before retrying...")
                time.sleep(retry_delay)
                retry_count += 1
                continue
            
            # For other errors, use standard backoff
            error_msg = f"Error in API call (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            logging.warning(error_msg)
            
            # If we've used all retries, give up and return an error message
            if retry_count >= max_retries:
                logging.error(f"All {max_retries + 1} attempts failed, giving up.")
                # Return a message that can be safely parsed
                return f"[START]API Error[BREAK]Failed after {max_retries + 1} attempts: {e}[END]"
            
            # Calculate retry delay using exponential backoff with jitter
            retry_delay = calculate_backoff(retry_count)
            logging.info(f"Retrying in {retry_delay:.2f} seconds...")
            time.sleep(retry_delay)
            retry_count += 1

async def generate_completion_async(prompt: str, system_role: str = "", model: str = None,
                                   temperature: float = 0.7, top_p: float = 0.3) -> str:
    """Async version of generate_completion for concurrent processing with rate limit handling"""
    # Use default model if none specified
    model = model or default_model
    
    # Determine provider based on model
    provider = get_provider_for_model(model)
    
    # Ensure we have an async client for this provider
    if provider not in async_clients:
        available_providers = ", ".join(async_clients.keys())
        raise ValueError(f"No async API client configured for provider '{provider}'. Available providers: {available_providers}")
    
    async_client = async_clients[provider]
    
    max_retries = 5
    retry_count = 0
    
    # Check rate limit proactively if model has a rate limiter - but only check if the prompt is large
    if provider == "openai" and model in PROVIDERS["openai"]["models"]:
        rate_limiter = PROVIDERS["openai"]["models"][model].get("rate_limiter")
        if rate_limiter:
            # Only check rate limit for large prompts (over 1000 chars)
            if len(prompt) > 1000:
                # Estimate tokens (very rough approximation)
                tokens_estimate = estimate_tokens(prompt + system_role)
                
                # Check if we should proceed or wait
                can_proceed, wait_time = await rate_limiter.check_rate_limit(tokens_estimate)
                if not can_proceed:
                    logging.info(f"Rate limit proactively avoided. Waiting {wait_time:.2f}s before proceeding.")
                    await asyncio.sleep(wait_time)
    
    while retry_count <= max_retries:
        try:
            response = await async_client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": system_role},
                    {"role": "user", "content": prompt}
                ],
                temperature=temperature,
                top_p=top_p,
                timeout=30
            )
            
            # Record tokens used if we have a rate limiter for this model
            if provider == "openai" and model in PROVIDERS["openai"]["models"]:
                rate_limiter = PROVIDERS["openai"]["models"][model].get("rate_limiter")
                if rate_limiter and hasattr(response, 'usage') and response.usage:
                    total_tokens = response.usage.total_tokens
                    await rate_limiter.add_tokens(total_tokens)
            
            return response.choices[0].message.content.strip()
        
        except Exception as e:
            error_str = str(e)
            
            # Special handling for rate limit errors
            if "rate_limit_exceeded" in error_str or "Rate limit" in error_str:
                # Parse retry time from error message if available
                retry_time = parse_retry_time_from_error(error_str)
                
                # If we got a specific retry time, use it (with a small buffer)
                if retry_time > 0:
                    retry_delay = retry_time + 0.1  # Add 100ms buffer
                else:
                    # Otherwise use exponential backoff with jitter
                    retry_delay = calculate_backoff(retry_count)
                
                logging.warning(f"Rate limit hit (async). Waiting {retry_delay:.2f}s before retrying...")
                await asyncio.sleep(retry_delay)
                retry_count += 1
                continue
            
            # For other errors, use standard backoff
            error_msg = f"Error in async API call (attempt {retry_count + 1}/{max_retries + 1}): {e}"
            logging.warning(error_msg)
            
            if retry_count >= max_retries:
                logging.error(f"All async {max_retries + 1} attempts failed, giving up.")
                return f"[START]API Error[BREAK]Failed after {max_retries + 1} attempts: {e}[END]"
            
            # Calculate retry delay using exponential backoff with jitter
            retry_delay = calculate_backoff(retry_count)
            logging.info(f"Retrying async in {retry_delay:.2f} seconds...")
            await asyncio.sleep(retry_delay)
            retry_count += 1

class RequestQueue:
    """Queue for managing concurrent API requests to prevent rate limit issues"""
    def __init__(self, max_concurrent=50, interval=0.05):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.interval = interval
    
    async def execute(self, coroutine):
        """Execute a coroutine with controlled concurrency"""
        async with self.semaphore:
            result = await coroutine
            # Add small delay between requests
            await asyncio.sleep(self.interval)
            return result

async def generate_completions_concurrent(prompts: List[str], system_role: str = "", model: str = None,
                                         temperature: float = 0.7, top_p: float = 0.3) -> List[str]:
    """Generate multiple completions concurrently using asyncio with rate limit awareness"""
    request_queue = RequestQueue(max_concurrent=100, interval=0.05)  # Increased concurrency, reduced interval
    
    tasks = []
    for prompt in prompts:
        # Wrap each generation in the request queue
        task = request_queue.execute(
            generate_completion_async(prompt, system_role, model, temperature, top_p)
        )
        tasks.append(task)
    
    return await asyncio.gather(*tasks)

def generate_completions_batch(prompts: List[str], system_role: str = "", model: str = None,
                              temperature: float = 0.7, top_p: float = 0.3) -> List[str]:
    """
    Generate completions for multiple prompts concurrently
    This provides a way to process multiple prompts efficiently
    """
    return asyncio.run(generate_completions_concurrent(prompts, system_role, model, temperature, top_p))
            
def parse_llm_output(llm_response: str) -> Optional[List[Tuple[str, str]]]:
    """
    Parse LLM response into list of (summary, description) tuples.
    Automatically appends [END] tag if missing.
    Ignores any text before the first [START] tag.
    
    Returns None if there are any validation errors or parsing issues
    instead of raising exceptions.
    """
    
    # Check for API error response first
    if llm_response.startswith("[START]API Error[BREAK]"):
        logging.error(f"API Error detected in response: {llm_response}")
        return None
    
    # Find the first occurrence of [START] and ignore everything before it
    first_start = llm_response.find('[START]')
    if first_start == -1:
        print(f"No [START] tags found in response: {llm_response}")
        return None
        
    llm_response = llm_response[first_start:]
    
    # Split into individual items
    items = llm_response.split('[START]')
    items = [item.strip() for item in items if item.strip()]
    
    if not items:
        print("No valid items found after splitting by [START]")
        return None
    
    parsed_items = []
    try:
        for item in items:
            # Append [END] tag if missing
            if not item.endswith('[END]'):
                item = item + '[END]'
                
            # Remove [END] tag
            item = item[:-5].strip()
            
            # Split into summary and description
            parts = item.split('[BREAK]')
            if len(parts) != 2:
                print(f"Item does not have exactly 2 parts: {item}")
                # Instead of raising an error, we'll return None
                return None
            
            summary, description = parts
            parsed_items.append((summary.strip(), description.strip()))
        
        return parsed_items
    
    except Exception as e:
        print(f"Error parsing LLM output: {e}")
        return None

def parse_batch_outputs(batch_responses: List[str]) -> List[Optional[List[Tuple[str, str]]]]:
    """
    Parse multiple LLM responses from a batch
    Returns a list of parsed responses, each parsed using parse_llm_output
    """
    return [parse_llm_output(response) for response in batch_responses]
    
def set_default_model(model_name: str):
    """Set the default model to use for completions"""
    global default_model
    # Check if model exists in our provider configurations
    found = False
    for provider, config in PROVIDERS.items():
        if model_name in config["models"]:
            found = True
            break
    
    if not found:
        raise ValueError(f"Unknown model: {model_name}. Available models: {get_available_models()}")
    
    default_model = model_name
    print(f"Default model set to: {model_name}")

def get_available_models():
    """Get list of available models across all providers"""
    available_models = {}
    for provider, config in PROVIDERS.items():
        if provider in clients:  # Only include if we have API key
            available_models[provider] = list(config["models"].keys())
    return available_models

if __name__ == "__main__":
    print("Prompt LLM Module")
    # Example usage
    prompts = load_prompts()
    print("Loaded Prompts")
    
    print("Available models:", get_available_models())
    
    # Example using OpenAI model
    openai_response = generate_completion(
        "What is Knowledge?", 
        model="gpt-4o"
    )
    print("OpenAI Response:", openai_response[:100] + "...")
    
    # Example using Deepseek model
    try:
        deepseek_response = generate_completion(
            "Tell me about knowledge", 
            model="deepseek-reasoner"
        )
        print("Deepseek Response:", deepseek_response[:100] + "...")
    except ValueError as e:
        print(f"Deepseek error: {e}")
    
    # Generate a completion using the thesis prompt with default model
    thesis_prompt = prompts['thesis'].format(
        central_question="What is knowledge?",
        num_responses=3,
        num_reasons=2
    )
    
    response = generate_completion(thesis_prompt)
    print(response[:100] + "...")
    # Parse the LLM output
    parsed_response = parse_llm_output(response)
    
    if parsed_response:
        print("Parsed Response:")
        for summary, description in parsed_response:
            print(f"Summary: {summary}, Description: {description}")
    else:
        print("Failed to parse LLM output.")
    
    # Example of batch processing with specific model
    batch_prompts = [
        "What is empiricism?",
        "What is rationalism?",
        "What is pragmatism?"
    ]
    
    batch_responses = generate_completions_batch(
        batch_prompts,
        model="gpt-4o"  # Explicitly specify model
    )
    print(f"Received {len(batch_responses)} batch responses")