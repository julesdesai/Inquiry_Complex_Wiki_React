// src/services/explanationService.js - With Streaming Support
import { getNode } from '../firebase';

/**
 * Fetches the appropriate explanation prompt based on node type and explanation style
 * @param {string} nodeType - The type of node (question, thesis, etc.)
 * @param {string} style - The explanation style ('standard' or 'simple')
 * @returns {Promise<string>} - The prompt template
 */
export const getExplanationPrompt = async (nodeType, style = 'standard') => {
  try {
    // Construct the path based on style
    const stylePrefix = style === 'simple' ? 'simple_' : '';
    const promptPath = `/prompts/explanation/${stylePrefix}explain_${nodeType}.txt`;
    console.log('Style:', style, 'Prompt path:', promptPath); // Fixed variable name
    
    try {
      const response = await fetch(promptPath);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch prompt: ${response.status}`);
      }
      
      return await response.text();
    } catch (fetchError) {
      // If simple style prompt is not found, fall back to standard prompt
      if (style === 'simple') {
        console.warn(`Simple explanation prompt not found for ${nodeType}, falling back to standard`);
        
        // Use a fallback generic simple prompt instead of making another API call
        return getGenericPrompt(nodeType, 'standard');
      }
      
      // For standard style, fall back to generic prompt
      return getGenericPrompt(nodeType, 'standard');
    }
  } catch (error) {
    console.error('Error in getExplanationPrompt:', error);
    return getGenericPrompt(nodeType, style);
  }
};

/**
 * Returns a generic prompt template based on style
 * @param {string} nodeType - The type of node
 * @param {string} style - The explanation style
 * @returns {string} - A generic prompt template
 */
const getGenericPrompt = (nodeType, style) => {
  if (style === 'simple') {
    return `Explain this philosophical node of type "${nodeType}" in simple, everyday language that's easy for anyone to understand:
Summary: {{summary}}
Content: {{content}}
Parent Node Summary: {{parent_summary}}
Parent Node Content: {{parent_content}}
Grandparent Node Summary: {{grandparent_summary}}
Grandparent Node Content: {{grandparent_content}}

Please provide a clear, jargon-free explanation using simple words and everyday examples.`;
  } else {
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
 * Fetches an explanation for the node with streaming support
 * @param {Object} nodeData - The node data
 * @param {Function} onChunk - Callback function to handle incoming text chunks
 * @param {string} explanationStyle - The style of explanation ('standard' or 'simple')
 * @returns {Promise<string>} - The complete explanation text
 */
export const fetchExplanationStream = async (nodeData, onChunk, explanationStyle = 'standard') => {
  try {
    const { node_type: nodeType, parent_id: parentId } = nodeData;
    const collectionName = nodeData.collectionName || 'nodes';
    
    console.log(`Generating explanation for node type: ${nodeType} with style: ${explanationStyle}`);
    
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
    
    // Get the appropriate prompt template with the requested style
    const promptTemplate = await getExplanationPrompt(nodeType, explanationStyle);
    
    // Fill the template with node, parent, and grandparent data
    const filledPrompt = fillPromptTemplate(promptTemplate, nodeData, parentData, grandparentData);
    
    try {
      // Call the streaming API
      return await callOpenAIAPIStream(filledPrompt, onChunk);
    } catch (apiError) {
      console.warn('API streaming call failed:', apiError);
      throw apiError;
    }
  } catch (error) {
    console.error('Error generating streaming explanation:', error);
    throw error;
  }
};

/**
 * Calls the OpenAI API with streaming enabled
 * @param {string} prompt - The prompt to send to the API
 * @param {Function} onChunk - Callback function to handle incoming text chunks
 * @returns {Promise<string>} - The complete response from the API
 */
const callOpenAIAPIStream = async (prompt, onChunk) => {
  // Check if the API key is set in the environment variables
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('API key not found. Please set OPENAI_API_KEY in your environment variables.');
    throw new Error('API key not configured');
  }
  
  try {
    console.log('Calling OpenAI API with streaming and prompt length:', prompt.length);
    
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
        temperature: 0.7,
        stream: true // Enable streaming
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    // Create a reader from the response body stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let completeText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      // Decode the chunk
      const chunk = decoder.decode(value, { stream: true });
      
      // Process the SSE stream chunk
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.substring(6);
          
          // Skip the [DONE] message
          if (data === '[DONE]') continue;
          
          try {
            const json = JSON.parse(data);
            const content = json.choices[0]?.delta?.content || '';
            
            if (content) {
              completeText += content;
              // Call the onChunk callback with the new content
              onChunk(content);
            }
          } catch (e) {
            console.error('Error parsing streaming JSON:', e, data);
          }
        }
      }
    }
    
    return completeText;
  } catch (error) {
    console.error('OpenAI API streaming call failed:', error);
    throw error;
  }
};

/**
 * For backward compatibility - non-streaming version
 * @param {Object} nodeData - The node data
 * @param {string} explanationStyle - The style of explanation ('standard' or 'simple')
 * @returns {Promise<string>} - The complete explanation text
 */
export const fetchExplanation = async (nodeData, explanationStyle = 'standard') => {
  let fullText = '';
  
  try {
    await fetchExplanationStream(nodeData, (chunk) => {
      fullText += chunk;
    }, explanationStyle);
    
    return fullText;
  } catch (error) {
    console.error('Error in non-streaming fetchExplanation:', error);
    throw error;
  }
};

// Create a service object with all the exported functions
const explanationService = {
  fetchExplanation,
  fetchExplanationStream,
  getExplanationPrompt,
  fillPromptTemplate
};

// Export the service object as default
export default explanationService;