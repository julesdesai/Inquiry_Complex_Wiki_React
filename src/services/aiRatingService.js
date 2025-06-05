// src/services/aiRatingService.js
import { getNode, updateAIRating } from '../firebase';

/**
 * Fetches the appropriate rating prompt based on node type
 * @param {string} nodeType - The type of node (question, thesis, etc.)
 * @returns {Promise<string>} - The rating prompt template
 */
export const getRatingPrompt = async (nodeType) => {
  try {
    const promptPath = `/prompts/rating/rate_${nodeType}.txt`;
    const response = await fetch(promptPath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch rating prompt: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching rating prompt:', error);
    // Fallback to a generic prompt if specific one isn't available
    return `Rate the quality of this philosophical node of type "${nodeType}" on a scale from 0 to 100:
Summary: {{summary}}
Content: {{content}}
Parent Node Summary: {{parent_summary}}
Parent Node Content: {{parent_content}}

Provide a single number between 0 and 100 representing the quality rating, where:
0-20: Poor quality - unclear, illogical, or irrelevant
21-40: Below average - has significant issues in reasoning or relevance
41-60: Average - acceptable but not exceptional
61-80: Good - clear, logical, and relevant 
81-100: Excellent - insightful, profound, and exceptionally well-reasoned

Your response should contain only a number between 0 and 100.`;
  }
};

/**
 * Fills the prompt template with node data including parent information
 * @param {string} promptTemplate - The prompt template
 * @param {Object} nodeData - The node data
 * @param {Object|null} parentData - The parent node data (if available)
 * @returns {string} - The filled prompt
 */
export const fillRatingPromptTemplate = (promptTemplate, nodeData, parentData = null) => {
  const { summary, content } = nodeData;
  
  let filledPrompt = promptTemplate
    .replace(/{{summary}}/g, summary || '')
    .replace(/{{content}}/g, content || '');
  
  // Add parent data if available
  if (parentData && parentData.summary && parentData.content) {
    filledPrompt = filledPrompt
      .replace(/{{parent_summary}}/g, parentData.summary)
      .replace(/{{parent_content}}/g, parentData.content);
  } else {
    filledPrompt = filledPrompt
      .replace(/{{parent_summary}}/g, 'Not available')
      .replace(/{{parent_content}}/g, 'Not available');
  }
  
  return filledPrompt;
};

/**
 * Fetches parent node data if available
 * @param {string} parentId - The parent node ID
 * @param {string} collectionName - The collection name
 * @returns {Promise<Object|null>} - The parent node data or null
 */
const fetchParentNodeData = async (parentId, collectionName) => {
  if (!parentId) return null;
  
  try {
    return await getNode(parentId, collectionName);
  } catch (error) {
    console.error('Error fetching parent node data:', error);
    return null;
  }
};

/**
 * Calls the OpenAI API to get an AI rating
 * @param {string} prompt - The prompt to send to the API
 * @returns {Promise<number>} - The AI rating (0-100)
 */
const callOpenAIAPI = async (prompt) => {
  // Check if the API key is set in the environment variables
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('API key not found. Please set OPENAI_API_KEY in your environment variables.');
    throw new Error('API key not configured');
  }
  
  try {
    console.log('Calling OpenAI API for AI rating with prompt length:', prompt.length);
    
    //const response = await fetch('https://api.openai.com/v1/chat/completions', {
    const response = await fetch('http://mike:8080/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek/deepseek-r1',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3, // Lower temperature for more consistent numerical ratings
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const ratingText = data.choices[0]?.message?.content || '';
    
    // Extract the numerical rating from the response
    // This regex looks for a number between 0 and 100
    const match = ratingText.match(/\b([0-9]|[1-9][0-9]|100)\b/);
    
    if (match) {
      return parseInt(match[0], 10);
    } else {
      console.warn('Could not extract numerical rating from API response:', ratingText);
      // Default to a neutral rating if we can't parse the response
      return 50;
    }
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    throw error;
  }
};

/**
 * Generates an AI rating for a node
 * @param {Object} nodeData - The node data
 * @param {string} collectionName - The collection name
 * @returns {Promise<number>} - The AI rating (0-100)
 */
export const generateAIRating = async (nodeData, collectionName = 'nodes') => {
  try {
    const { node_type: nodeType, parent_id: parentId, id: nodeId } = nodeData;
    
    // Skip AI rating for certain node types if needed
    if (nodeType === 'question') {
      console.log('Skipping AI rating for question nodes');
      return null;
    }
    
    // Fetch parent node data if parentId is available
    let parentData = null;
    if (parentId) {
      parentData = await fetchParentNodeData(parentId, collectionName);
    }
    
    // Get the appropriate prompt template
    const promptTemplate = await getRatingPrompt(nodeType);
    
    // Fill the template with node and parent data
    const filledPrompt = fillRatingPromptTemplate(promptTemplate, nodeData, parentData);
    
    // Get the AI rating
    const aiRating = await callOpenAIAPI(filledPrompt);
    
    console.log(`AI rating for node ${nodeId}: ${aiRating}`);
    return aiRating;
  } catch (error) {
    console.error('Error generating AI rating:', error);
    throw error;
  }
};

/**
 * Checks if a node already has an AI rating and returns the rating if available
 * @param {string} nodeId - The node ID
 * @param {string} collectionName - The collection name
 * @returns {Promise<{hasRating: boolean, rating: number|null}>} - Whether the node has an AI rating and the rating value
 */
export const getAIRating = async (nodeId, collectionName = 'nodes') => {
  try {
    if (!nodeId) {
      console.log('No nodeId provided to getAIRating');
      return { hasRating: false, rating: null };
    }
    
    console.log(`Checking AI rating for node: ${nodeId} in collection: ${collectionName}`);
    
    // Get the node data
    const nodeData = await getNode(nodeId, collectionName);
    
    if (!nodeData) {
      console.warn(`Node ${nodeId} not found in collection ${collectionName}`);
      return { hasRating: false, rating: null };
    }
    
    // Direct aiRating field in the new data structure
    const hasRating = nodeData.aiRating !== undefined;
    
    console.log(`AI rating for node ${nodeId}: ${hasRating ? nodeData.aiRating : 'none'}`);
    
    return {
      hasRating,
      rating: hasRating ? nodeData.aiRating : null
    };
  } catch (error) {
    console.error(`Error checking AI rating for node ${nodeId}:`, error);
    return { hasRating: false, rating: null };
  }
};

/**
 * Triggers an AI rating when the first human rating is submitted
 * This is the main function that should be called after a human rating is submitted
 * @param {string} nodeId - The node ID
 * @param {string} collectionName - The collection name
 * @returns {Promise<Object|null>} - The AI rating result or null if already rated
 */
export const triggerAIRating = async (nodeId, collectionName = 'nodes') => {
  try {
    // Check if the node already has an AI rating
    const { hasRating: hasExistingAIRating, rating: existingRating } = await getAIRating(nodeId, collectionName);
    
    // If it already has an AI rating, return the existing rating
    if (hasExistingAIRating) {
      console.log(`Node ${nodeId} already has an AI rating: ${existingRating}, skipping`);
      return {
        aiRating: existingRating,
        alreadyExists: true
      };
    }
    
    // Get the node data
    const nodeData = await getNode(nodeId, collectionName);
    
    // Generate the AI rating
    const aiRating = await generateAIRating(nodeData, collectionName);
    
    // If we got a valid rating, submit it
    if (aiRating !== null) {
      const result = await updateAIRating(nodeId, aiRating, collectionName);
      return {
        aiRating,
        updatedAverageRating: result.averageRating,
        updatedTotalRatings: result.totalRatingCount,
        alreadyExists: false
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error triggering AI rating for node ${nodeId}:`, error);
    return null;
  }
};

// Create a service object with all the exported functions
const aiRatingService = {
  generateAIRating,
  triggerAIRating,
  getAIRating,
  getRatingPrompt,
  fillRatingPromptTemplate
};

// Export the service object as default
export default aiRatingService;