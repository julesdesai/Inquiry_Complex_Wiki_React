// src/services/explanationService.js - Complete with all updates
import { getNode } from '../firebase';

/**
 * Fetches the appropriate explanation prompt based on node type
 * @param {string} nodeType - The type of node (question, thesis, etc.)
 * @returns {Promise<string>} - The prompt template
 */
export const getExplanationPrompt = async (nodeType) => {
  try {
    const promptPath = `/prompts/explanation/explain_${nodeType}.txt`;
    const response = await fetch(promptPath);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch prompt: ${response.status}`);
    }
    
    return await response.text();
  } catch (error) {
    console.error('Error fetching explanation prompt:', error);
    // Fallback to a generic prompt if specific one isn't available
    return `Explain this philosophical node of type "${nodeType}" with the following information:
Summary: {{summary}}
Content: {{content}}
Parent Node Summary: {{parent_summary}}
Parent Node Content: {{parent_content}}
Grandparent Node Summary: {{grandparent_summary}}
Grandparent Node Content: {{grandparent_content}}

Please provide a clear explanation that helps someone understand the philosophical significance and meaning.`;
  }
};

/**
 * Fills the prompt template with node data including parent and grandparent information
 * @param {string} promptTemplate - The prompt template
 * @param {Object} nodeData - The node data
 * @param {Object|null} parentData - The parent node data (if available)
 * @param {Object|null} grandparentData - The grandparent node data (if available)
 * @returns {string} - The filled prompt
 */
export const fillPromptTemplate = (promptTemplate, nodeData, parentData = null, grandparentData = null) => {
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
  
  // Add grandparent data if available and if the template uses it
  if (filledPrompt.includes('{{grandparent_summary}}') || filledPrompt.includes('{{grandparent_content}}')) {
    if (grandparentData && grandparentData.summary && grandparentData.content) {
      filledPrompt = filledPrompt
        .replace(/{{grandparent_summary}}/g, grandparentData.summary)
        .replace(/{{grandparent_content}}/g, grandparentData.content);
    } else {
      filledPrompt = filledPrompt
        .replace(/{{grandparent_summary}}/g, 'Not available')
        .replace(/{{grandparent_content}}/g, 'Not available');
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
 * Fetches an explanation for the node
 * @param {Object} nodeData - The node data
 * @returns {Promise<string>} - The explanation text
 */
export const fetchExplanation = async (nodeData) => {
  try {
    const { node_type: nodeType, parent_id: parentId } = nodeData;
    const collectionName = nodeData.collectionName || 'nodes'; // Get collection name if passed
    
    // Initialize parent and grandparent data
    let parentData = null;
    let grandparentData = null;
    
    // Fetch parent node data if the node type requires it and parentId is available
    if (['thesis', 'antithesis', 'reason', 'synthesis', 'direct_reply'].includes(nodeType) && parentId) {
      parentData = await fetchParentNodeData(parentId, collectionName);
      
      // For synthesis nodes, also fetch grandparent data (if parent has a parent)
      if (nodeType === 'synthesis' && parentData && parentData.parent_id) {
        grandparentData = await fetchParentNodeData(parentData.parent_id, collectionName);
      }
    }
    
    // Get the appropriate prompt template
    const promptTemplate = await getExplanationPrompt(nodeType);
    
    // Fill the template with node, parent, and grandparent data
    const filledPrompt = fillPromptTemplate(promptTemplate, nodeData, parentData, grandparentData);
    
    try {
      // Try to use the API first
      return await callOpenAIAPI(filledPrompt);
    } catch (apiError) {
      console.warn('API call failed, falling back to simulated responses:', apiError);
      // Fall back to simulated responses if the API call fails
      return;
    }
  } catch (error) {
    console.error('Error generating explanation:', error);
    throw error;
  }
};

/**
 * Calls the OpenAI API directly from the client
 * @param {string} prompt - The prompt to send to the API
 * @returns {Promise<string>} - The response from the API
 */
const callOpenAIAPI = async (prompt) => {
// Check if the API key is set in the environment variables
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('API key not found. Please set OPENAI_API_KEY in your environment variables.');
    throw new Error('API key not configured');
  }
  
  try {
    console.log('Calling OpenAI API with prompt length:', prompt.length);
    
    const response = await fetch('https://api.openai.com/v1/chat/completions', { //for OpenAI explanation calls
    //const response = await fetch('http://100.99.92.116:8080/chat/completions', {       //for ExoLabs 8-Bit Quantized Local explanation calls on 'James' mac studio;. Use TailScale and Seth's account to connect
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
        body: JSON.stringify({
        model: 'gpt-4o', //gpt-4o for OpenAI. deepseek/deepseek-r1 for ExoLabs 8Bit Quantized Local
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
        //max_tokens: 1000
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


export default {
  fetchExplanation,
  getExplanationPrompt,
  fillPromptTemplate
};