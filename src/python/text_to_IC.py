import os
import uuid
import json
import logging
from typing import Dict, List, Tuple, Optional
from prompt_llm import load_prompts, generate_completion, parse_llm_output, generate_completions_batch, parse_batch_outputs

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

input_text="Williams_Moral_Luck.txt"

class InquiryComplexExtractor:
    """
    Extracts inquiry complexes from text using a dialectical approach.
    
    An inquiry complex is a tree-structured graph with dialectical structure,
    consisting of nodes of type: question, thesis, reason, antithesis, synthesis, direct_reply
    """
    
    def __init__(self, 
                 text_passage: str,
                 max_depth: int = 3,
                 top_n_questions: int = 3,
                 save_dir: str = "./temp"):
        """
        Initialize the inquiry complex extractor.
        
        Args:
            text_passage: The text to analyze
            max_depth: Maximum depth for dialectical exploration
            top_n_questions: Number of top questions to explore
            save_dir: Directory to save results
        """
        self.text_passage = text_passage
        self.max_depth = max_depth
        self.top_n_questions = top_n_questions
        self.save_dir = save_dir
        
        # Initialize graph structure
        self.graph = {}
        self.edges = []
        
        # Load prompts from the original prompts directory
        self.prompts = self._load_text_prompts("./prompts/text")
        
        # Create save directory if it doesn't exist
        if not os.path.exists(save_dir):
            os.makedirs(save_dir)
    
    def _load_text_prompts(self, prompt_dir: str) -> Dict[str, str]:
        """Load text extraction prompts from files"""
        text_prompt_files = {
            "questions": "QuestionsfromText.txt",
            "rank_questions": "RankQuestionsfromText.txt", 
            "thesis": "ThesisExtractionfromText.txt",
            "reasons": "ReasonsfromText.txt",
            "antithesis": "AntithesisfromText.txt",
            "direct_reply": "DirectReplyFromText.txt",
            "synthesis": "SynthesisfromText.txt"
        }
        
        prompts = {}
        try:
            for prompt_type, filename in text_prompt_files.items():
                file_path = os.path.join(prompt_dir, filename)
                with open(file_path, 'r') as file:
                    prompts[prompt_type] = file.read().strip()
            return prompts
        except Exception as e:
            raise Exception(f"Error loading prompts from {prompt_dir}{file}: {e}")
    
    def extract_inquiry_complex(self) -> Dict:
        """
        Main method that orchestrates the entire inquiry complex extraction process.
        
        Returns:
            Dict: The complete inquiry complex as a JSON-serializable dictionary
        """
        logging.info("Starting inquiry complex extraction")
        
        # Step 1: Extract questions from text
        logging.info("Step 1: Extracting questions from text")
        questions = self.extract_questions()
        if not questions:
            logging.warning("No questions extracted from text")
            return self.to_json()
        
        # Step 2: Rank questions
        logging.info("Step 2: Ranking questions")
        ranked_questions = self.rank_questions(questions)
        if not ranked_questions:
            logging.warning("No questions could be ranked")
            return self.to_json()
        
        # Step 3: Select top N questions
        logging.info(f"Step 3: Selecting top {self.top_n_questions} questions")
        top_questions = self.select_top_questions(ranked_questions, self.top_n_questions)
        
        # Step 4-10: For each top question, build dialectical tree
        for question_data in top_questions:
            question_text = question_data[1]  # Get the actual question text
            logging.info(f"Building dialectical tree for question: {question_text[:100]}...")
            
            # Add question node to graph
            question_id = self.add_node(
                summary=question_data[0],  # summary
                content=question_text,
                node_type="question",
                parent_id=None,
                depth=0
            )
            
            # Build dialectical tree for this question
            self.build_dialectical_tree(question_id, question_text)
        
        logging.info("Inquiry complex extraction completed")
        return self.to_json()
    
    def extract_questions(self) -> Optional[List[Tuple[str, str]]]:
        """Extract questions from the text passage"""
        try:
            prompt = self.prompts["questions"].format(text_passage=self.text_passage)
            response = generate_completion(prompt, "")
            questions = parse_llm_output(response)
            logging.info(f"Extracted {len(questions) if questions else 0} questions")
            print(f"Extracted questions: {questions}")
            return questions
        except Exception as e:
            logging.error(f"Error extracting questions: {e}")
            return None
    
    def rank_questions(self, questions: List[Tuple[str, str]]) -> Optional[List[Tuple[str, str, int]]]:
        """Rank questions based on how well they're addressed in the text"""
        try:
            # Format questions for ranking prompt
            

            formatted_questions = "\n".join([
                f"[START]{summary}[BREAK]{question}[END]" 
                for summary, question in questions
            ])
            
            #print(f"Formatted questions for ranking: {formatted_questions}")
            
           
            
            prompt = self.prompts["rank_questions"].format(
                list_questions=formatted_questions,
                text_passage=self.text_passage
            )
            
            #print(f"Ranking prompt: {prompt}")
            
            response = generate_completion(prompt, "")
            
            print("Ranking response:", response)
            
            # Parse ranking response - this should return questions with rank numbers
            ranked_questions = self._parse_ranking_output(response)
            
            if ranked_questions:
                # Sort by rank (highest first)
                ranked_questions.sort(key=lambda x: x[2], reverse=True)
                logging.info(f"Successfully ranked {len(ranked_questions)} questions")
            
            return ranked_questions
        except Exception as e:
            logging.error(f"Error ranking questions: {e}")
            return None
    
    def _parse_ranking_output(self, response: str) -> List[Tuple[str, str, int]]:
        """Parse the ranking output to extract questions with their ranks"""
        ranked_questions = []
        
        # Split by [START] and process each item
        items = response.split('[START]')
        for item in items:
            if not item.strip():
                continue
                
            item = item.strip()
            if not item.endswith('[END]'):
                item = item + '[END]'
            
            item = item[:-5].strip()  # Remove [END]
            
            # Split by [BREAK] to get parts
            parts = item.split('[BREAK]')
            if len(parts) >= 3:
                summary = parts[0].strip()
                question = parts[1].strip()
                try:
                    #print(parts[2].strip())
                    # Remove curly braces and convert to int
                    rank_str = parts[2].strip().replace("{", "").replace("}", "")
                    rank = int(rank_str)
                    ranked_questions.append((summary, question, rank))
                except ValueError:
                    logging.warning(f"Could not parse rank for question: {summary}")
        
        return ranked_questions
    
    def select_top_questions(self, ranked_questions: List[Tuple[str, str, int]], n: int) -> List[Tuple[str, str]]:
        """Select the top N ranked questions"""
        top_questions = ranked_questions[:n]
        # Return without rank numbers
        return [(summary, question) for summary, question, rank in top_questions]
    
    def build_dialectical_tree(self, question_id: str, question_text: str):
        """Build the full dialectical tree for a question"""
        try:
            # Step 4: Generate theses for the question
            logging.info(f"Generating theses for question: {question_id}")
            theses = self.generate_theses_for_question(question_text)
            
            if not theses:
                logging.warning(f"No theses generated for question: {question_id}")
                return
            
            thesis_ids = []
            for thesis in theses:
                thesis_id = self.add_node(
                    summary=thesis[0],
                    content=thesis[1],
                    node_type="thesis",
                    parent_id=question_id,
                    depth=1
                )
                thesis_ids.append(thesis_id)
            
            # Step 5: Generate reasons for each thesis
            logging.info(f"Generating reasons for {len(thesis_ids)} theses")
            for thesis_id in thesis_ids:
                thesis_data = self.graph[thesis_id]
                thesis_content = (thesis_data["summary"], thesis_data["content"])
                
                reasons = self.generate_reasons_for_thesis(thesis_content)
                if reasons:
                    for reason in reasons:
                        self.add_node(
                            summary=reason[0],
                            content=reason[1],
                            node_type="reason",
                            parent_id=thesis_id,
                            depth=-1  # Special depth for reasons
                        )
            
            # Step 6+: Continue dialectical process
            self._continue_dialectical_process(thesis_ids, 2)
            
        except Exception as e:
            logging.error(f"Error building dialectical tree for question {question_id}: {e}")
    
    def _continue_dialectical_process(self, node_ids: List[str], current_depth: int):
        """Continue the dialectical process recursively"""
        if current_depth > self.max_depth:
            return
        
        new_node_ids = []
        
        for node_id in node_ids:
            node_data = self.graph[node_id]
            node_content = (node_data["summary"], node_data["content"])
            node_type = node_data["node_type"]
            
            if node_type in ["thesis", "synthesis"]:
                # Generate antitheses and direct replies
                antitheses = self.generate_antitheses_for_thesis(node_content)
                if antitheses:
                    for antithesis in antitheses:
                        antithesis_id = self.add_node(
                            summary=antithesis[0],
                            content=antithesis[1],
                            node_type="antithesis",
                            parent_id=node_id,
                            depth=current_depth
                        )
                        
                        # Generate direct replies
                        direct_replies = self.generate_direct_replies(node_content, antithesis)
                        if direct_replies:
                            for reply in direct_replies:
                                self.add_node(
                                    summary=reply[0],
                                    content=reply[1],
                                    node_type="direct_reply",
                                    parent_id=antithesis_id,
                                    depth=current_depth + 1
                                )
                        
                        # Generate syntheses
                        syntheses = self.generate_synthesis(node_content, antithesis)
                        if syntheses:
                            for synthesis in syntheses:
                                synthesis_id = self.add_node(
                                    summary=synthesis[0],
                                    content=synthesis[1],
                                    node_type="synthesis",
                                    parent_id=antithesis_id,
                                    depth=current_depth + 1
                                )
                                new_node_ids.append(synthesis_id)
        
        # Continue with new synthesis nodes
        if new_node_ids and current_depth + 1 <= self.max_depth:
            self._continue_dialectical_process(new_node_ids, current_depth + 2)
    
    def generate_theses_for_question(self, question: str) -> Optional[List[Tuple[str, str]]]:
        """Generate theses that answer a central question"""
        try:
            prompt = self.prompts["thesis"].format(
                central_question=question,
                text_passage=self.text_passage
            )
            response = generate_completion(prompt, "")
            return parse_llm_output(response)
        except Exception as e:
            logging.error(f"Error generating theses: {e}")
            return None
    
    def generate_reasons_for_thesis(self, thesis: Tuple[str, str]) -> Optional[List[Tuple[str, str]]]:
        """Generate supporting reasons for a thesis"""
        try:
            prompt = self.prompts["reasons"].format(
                thesis=thesis,
                text_passage=self.text_passage
            )
            response = generate_completion(prompt, "")
            return parse_llm_output(response)
        except Exception as e:
            logging.error(f"Error generating reasons: {e}")
            return None
    
    def generate_antitheses_for_thesis(self, thesis: Tuple[str, str]) -> Optional[List[Tuple[str, str]]]:
        """Generate antitheses (objections) for a thesis"""
        try:
            prompt = self.prompts["antithesis"].format(
                thesis=thesis,
                text_passage=self.text_passage
            )
            response = generate_completion(prompt, "")
            return parse_llm_output(response)
        except Exception as e:
            logging.error(f"Error generating antitheses: {e}")
            return None
    
    def generate_direct_replies(self, thesis: Tuple[str, str], antithesis: Tuple[str, str]) -> Optional[List[Tuple[str, str]]]:
        """Generate direct replies to thesis-antithesis pairs"""
        try:
            prompt = self.prompts["direct_reply"].format(
                thesis=thesis,
                antithesis=antithesis,
                text_passage=self.text_passage
            )
            response = generate_completion(prompt, "")
            return parse_llm_output(response)
        except Exception as e:
            logging.error(f"Error generating direct replies: {e}")
            return None
    
    def generate_synthesis(self, thesis: Tuple[str, str], antithesis: Tuple[str, str]) -> Optional[List[Tuple[str, str]]]:
        """Generate syntheses from thesis-antithesis pairs"""
        try:
            prompt = self.prompts["synthesis"].format(
                thesis=thesis,
                antithesis=antithesis,
                text_passage=self.text_passage
            )
            response = generate_completion(prompt, "")
            return parse_llm_output(response)
        except Exception as e:
            logging.error(f"Error generating synthesis: {e}")
            return None
    
    def add_node(self, summary: str, content: str, node_type: str, parent_id: Optional[str], depth: int) -> str:
        """Add a new node to the graph"""
        node_id = str(uuid.uuid4())
        
        self.graph[node_id] = {
            "summary": summary,
            "content": content,
            "node_type": node_type,
            "parent_id": parent_id,
            "depth": depth,
            "terminal": False,
            "nonsense": False,
            "identical_to": None
        }
        
        # Mark central questions
        if node_type == "question" and parent_id is None:
            self.graph[node_id]["is_central_question"] = True
        
        # Add edge if there's a parent
        if parent_id:
            self.edges.append((parent_id, node_id))
        
        logging.info(f"Added {node_type} node: {node_id}")
        return node_id
    
    def to_json(self) -> Dict:
        """Convert the inquiry complex to JSON format"""
        return self.graph
    
    def save_to_file(self, filename: str = f"{input_text}_inquiry_complex.json"):
        """Save the inquiry complex to a JSON file"""
        filepath = os.path.join(self.save_dir, filename)
        with open(filepath, 'w') as f:
            json.dump(self.to_json(), f, indent=2)
        logging.info(f"Saved inquiry complex to {filepath}")
    
    def get_stats(self) -> Dict:
        """Get statistics about the inquiry complex"""
        stats = {
            "total_nodes": len(self.graph),
            "total_edges": len(self.edges),
            "node_types": {},
            "max_depth": 0
        }
        
        for node_data in self.graph.values():
            node_type = node_data["node_type"]
            stats["node_types"][node_type] = stats["node_types"].get(node_type, 0) + 1
            
            if node_data["depth"] > stats["max_depth"]:
                stats["max_depth"] = node_data["depth"]
        
        return stats


# Example usage
if __name__ == "__main__":
    
    

    # Create extractor
    with open(f"input_texts/{input_text}", "r") as f:
        input_text = f.read()
    extractor = InquiryComplexExtractor(
        text_passage=input_text,
        max_depth=3,
        top_n_questions=3
    )
    
    # Extract inquiry complex
    inquiry_complex = extractor.extract_inquiry_complex()
    
    # Print results
    print("=== INQUIRY COMPLEX EXTRACTION RESULTS ===")
    print(f"Statistics: {extractor.get_stats()}")
    print("\nFirst few nodes:")
    for i, (node_id, node_data) in enumerate(inquiry_complex.items()):
        if i < 5:  # Show first 5 nodes
            print(f"Node {node_id}:")
            print(f"  Type: {node_data['node_type']}")
            print(f"  Summary: {node_data['summary']}")
            print(f"  Depth: {node_data['depth']}")
            print()
    
    # Save to file
    extractor.save_to_file()