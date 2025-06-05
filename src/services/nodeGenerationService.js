// src/services/nodeGenerationService.js
import { getNode } from '../firebase';
import { v4 as uuidv4 } from 'uuid';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

/**
 * Fetches the appropriate generation prompt based on parent node type
 * @param {string} nodeType - The type of parent node (question, thesis, etc.)
 * @returns {Promise<string>} - The prompt template
 */
export const getGenerationPrompt = async (nodeType) => {
  try {
    const promptPath = `/prompts/children_generation/generate_${nodeType}.txt`;
    const response = await fetch(promptPath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching generation prompt:', error);
    throw new Error(`No generation prompt available for node type: ${nodeType}`);
  }
};

/**
 * Fills the prompt template with node data including parent and grandparent information
 * @param {string} promptTemplate - The prompt template
 * @param {Object} nodeData - The node data (parent node in the hierarchy)
 * @param {Object|null} parentData - The parent's parent data (grandparent node)
 * @param {string} userInput - The user's input text
 * @returns {string} - The filled prompt
 */
export const fillPromptTemplate = (promptTemplate, nodeData, parentData = null, userInput = '') => {
  const { summary, content } = nodeData;
  
  let filledPrompt = promptTemplate
    .replace(/\{parent_summary\}/g, summary || '')
    .replace(/\{parent_content\}/g, content || '')
    .replace(/\{user_input\}/g, userInput || '');
  
  // Add grandparent data if available and if the template uses it
  if (filledPrompt.includes('{grandparent_summary}') || filledPrompt.includes('{grandparent_content}')) {
    if (parentData && parentData.summary && parentData.content) {
      filledPrompt = filledPrompt
        .replace(/\{grandparent_summary\}/g, parentData.summary || '')
        .replace(/\{grandparent_content\}/g, parentData.content || '');
    } else {
      filledPrompt = filledPrompt
        .replace(/\{grandparent_summary\}/g, 'Not available')
        .replace(/\{grandparent_content\}/g, 'Not available');
    }
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
 * Calls the OpenAI API
 * @param {string} prompt - The prompt to send to the API
 * @returns {Promise<string>} - The response from the API
 */
const callOpenAIAPI = async (prompt) => {
  // Check if the API key is set in the environment variables
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('API key not found. Please set REACT_APP_OPENAI_API_KEY in your environment variables.');
    throw new Error('API key not configured');
  }
  
  try {
    console.log('Calling OpenAI API with prompt length:', prompt.length);
    
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
        temperature: 0.7
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('OpenAI API call failed:', error);
    throw error;
  }
};

/**
 * Parse response to extract items
 * @param {string} response - The API response
 * @returns {Object|null} - Extracted item or null
 */
export const parseGenerationResponse = (response) => {
  const pattern = /\[START\]([\s\S]*?)\[BREAK\]([\s\S]*?)\[END\]/g;
  
  let match = pattern.exec(response);
  if (match && match.length === 3) {
    const summary = match[1].trim();
    const content = match[2].trim();
    return { summary, content };
  }
  
  return null;
};

/**
 * Determine the possible child node types based on parent node type
 * @param {string} parentNodeType - The parent node type
 * @returns {Array<string>} - Array of possible child node types
 */
export const getPossibleChildNodeTypes = (parentNodeType) => {
  switch (parentNodeType) {
    case 'question':
      return ['thesis'];
    case 'thesis':
      return ['antithesis', 'reason'];
    case 'antithesis':
      return ['synthesis', 'direct_reply'];
    case 'synthesis':
      return ['antithesis'];  // Only antithesis for synthesis nodes
    default:
      return [];
  }
};

/**
 * Determine if the node type should be terminal
 * @param {string} nodeType - The node type
 * @returns {boolean} - Whether the node should be terminal
 */
export const isTerminalNodeType = (nodeType) => {
  return ['reason', 'direct_reply'].includes(nodeType);
};

/**
 * Generate a node preview based on user input
 * @param {Object} parentNode - The parent node data
 * @param {string} childNodeType - The type of child node to generate
 * @param {string} userInput - The user's input text
 * @param {string} collectionName - The collection name
 * @returns {Promise<Object>} - The candidate node
 */
export const generateNodePreview = async (parentNode, childNodeType, userInput, collectionName = 'nodes') => {
  const { id: parentId, node_type: parentNodeType, depth: parentDepth = 0 } = parentNode;
  
  // Validate node type
  const possibleTypes = getPossibleChildNodeTypes(parentNodeType);
  if (!possibleTypes.includes(childNodeType)) {
    throw new Error(`Invalid child node type "${childNodeType}" for parent of type "${parentNodeType}"`);
  }
  
  try {
    // Fetch grandparent data if needed
    let grandparentData = null;
    if (parentNode.parent_id) {
      grandparentData = await fetchParentNodeData(parentNode.parent_id, collectionName);
    }
    
    // Get the appropriate prompt template
    const promptTemplate = await getGenerationPrompt(childNodeType);
    
    // Fill the template with parent, grandparent data, and user input
    const filledPrompt = fillPromptTemplate(promptTemplate, parentNode, grandparentData, userInput);
    
    // Call the OpenAI API
    const apiResponse = await callOpenAIAPI(filledPrompt);
    
    // Parse the response
    const parsedItem = parseGenerationResponse(apiResponse);
    
    if (!parsedItem) {
      throw new Error('Failed to parse the AI response into the correct format');
    }
    
    // Determine if this node type is terminal
    const isTerminal = isTerminalNodeType(childNodeType);
    
    // Create a candidate node object with user_generated flag set to true
    return {
      summary: parsedItem.summary,
      content: parsedItem.content,
      node_type: childNodeType,
      parent_id: parentId,
      depth: (parentDepth || 0) + 1,
      terminal: isTerminal,
      user_generated: true, // Mark that this node was created through user input
      createdAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error generating node preview:', error);
    throw error;
  }
};

/**
 * Save a candidate node to Firebase
 * @param {Object} candidateNode - The candidate node to save
 * @param {string} parentId - The parent node ID
 * @param {string} collectionName - The collection name
 * @returns {Promise<Object>} - The saved node with ID
 */
export const saveNodeToFirebase = async (candidateNode, parentId, collectionName = 'nodes') => {
  const db = getFirestore();
  const nodeId = uuidv4();
  
  try {
    // Ensure parent ID is set
    const nodeToSave = {
      ...candidateNode,
      parent_id: parentId
    };
    
    // Add to Firestore
    await setDoc(doc(db, collectionName, nodeId), nodeToSave);
    
    // Return the saved node with ID
    return { id: nodeId, ...nodeToSave };
  } catch (error) {
    console.error('Error saving node to Firebase:', error);
    throw error;
  }
};

export default {
  generateNodePreview,
  saveNodeToFirebase,
  getPossibleChildNodeTypes,
  parseGenerationResponse,
  getGenerationPrompt,
  isTerminalNodeType
};