// src/services/thisHouseBelievesService.js
import { getFirestore, collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';

/**
 * Gets all nodes that have been modified by users (have ratings, images, or are user-generated)
 * @param {string} collectionName - Collection name (default: 'nodes')
 * @returns {Promise<Array>} - Array of modified node objects
 */
export const getUserModifiedNodes = async (collectionName = 'nodes') => {
  try {
    console.log(`Fetching user-modified nodes from ${collectionName}`);
    
    // Initialize Firestore
    const db = getFirestore();
    
    // Query for nodes that have human ratings
    const humanRatingsQuery = query(
      collection(db, collectionName),
      where('humanRatingCount', '>', 0)
    );
    
    // Query for nodes that have images
    const imagesQuery = query(
      collection(db, collectionName),
      where('has_image', '==', true)  // Changed from 'hasImages' to 'has_image'
    );
    
    // Query for user-generated nodes
    const userGeneratedQuery = query(
      collection(db, collectionName),
      where('user_generated', '==', true)
    );
    
    // Execute all queries in parallel
    const [humanRatingsSnapshot, imagesSnapshot, userGeneratedSnapshot] = await Promise.all([
      getDocs(humanRatingsQuery),
      getDocs(imagesQuery),
      getDocs(userGeneratedQuery)
    ]);
    
    // Create a Map to store unique nodes
    const modifiedNodes = new Map();
    
    // Process nodes with human ratings
    humanRatingsSnapshot.forEach((doc) => {
      modifiedNodes.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    // Process nodes with images
    imagesSnapshot.forEach((doc) => {
      if (!modifiedNodes.has(doc.id)) {
        modifiedNodes.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });
    
    // Process user-generated nodes
    userGeneratedSnapshot.forEach((doc) => {
      if (!modifiedNodes.has(doc.id)) {
        modifiedNodes.set(doc.id, { id: doc.id, ...doc.data() });
      }
    });
    
    const nodes = Array.from(modifiedNodes.values());
    console.log(`Found ${nodes.length} user-modified nodes in ${collectionName}`);
    
    return nodes;
  } catch (error) {
    console.error(`Error fetching user-modified nodes from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Gets all thesis nodes from a collection
 * @param {string} collectionName - Collection name (default: 'nodes')
 * @returns {Promise<Array>} - Array of thesis nodes
 */
export const getAllThesisNodes = async (collectionName = 'nodes') => {
  try {
    console.log(`Fetching all thesis nodes from ${collectionName}`);
    
    // Initialize Firestore
    const db = getFirestore();
    
    // Query for thesis nodes
    const thesisQuery = query(
      collection(db, collectionName),
      where('node_type', '==', 'thesis')
    );
    
    const thesisSnapshot = await getDocs(thesisQuery);
    
    const thesisNodes = [];
    thesisSnapshot.forEach((doc) => {
      thesisNodes.push({ id: doc.id, ...doc.data() });
    });
    
    console.log(`Found ${thesisNodes.length} thesis nodes in ${collectionName}`);
    return thesisNodes;
  } catch (error) {
    console.error(`Error fetching thesis nodes from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Gets the root question node
 * @param {string} collectionName - Collection name (default: 'nodes')
 * @returns {Promise<Object|null>} - The root question node or null
 */
export const getRootQuestionNode = async (collectionName = 'nodes') => {
  try {
    console.log(`Fetching root question node from ${collectionName}`);
    
    // Initialize Firestore
    const db = getFirestore();
    
    // Query for root question node (depth = 0, node_type = 'question')
    const rootQuery = query(
      collection(db, collectionName),
      where('depth', '==', 0),
      where('node_type', '==', 'question')
    );
    
    const rootSnapshot = await getDocs(rootQuery);
    
    // Should only be one root question node
    if (rootSnapshot.empty) {
      console.warn('No root question node found');
      return null;
    }
    
    // Get the first matching node
    const rootNode = { id: rootSnapshot.docs[0].id, ...rootSnapshot.docs[0].data() };
    console.log(`Found root question: ${rootNode.summary}`);
    return rootNode;
  } catch (error) {
    console.error(`Error fetching root question node from ${collectionName}:`, error);
    throw error;
  }
};

/**
 * Calls the OpenAI API to generate "This House Believes" statements
 * @param {Array} modifiedNodes - Array of user-modified node objects
 * @param {string} collectionName - Collection name (default: 'nodes')
 * @returns {Promise<Array>} - Array of belief objects
 */
export const generateThisHouseBelieves = async (modifiedNodes, collectionName = 'nodes') => {
  // Check if the API key is set in the environment variables
  const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('API key not found. Please set REACT_APP_OPENAI_API_KEY in your environment variables.');
    throw new Error('API key not configured');
  }
  
  try {
    // Get the root question node
    const rootQuestionNode = await getRootQuestionNode(collectionName);
    if (!rootQuestionNode) {
      throw new Error('No root question node found');
    }
    
    // Get all thesis nodes
    const thesisNodes = await getAllThesisNodes(collectionName);
    if (thesisNodes.length === 0) {
      throw new Error('No thesis nodes found');
    }
    
    // Format the thesis list
    const thesisList = thesisNodes.map(node => {
      return `Title: ${node.summary}
Content: ${node.content || 'No content available'}`;
    }).join('\n\n');
    
    // Format the user modified node data
    const userModifiedNodeData = modifiedNodes.map(node => {
      return `Node ID: ${node.id}
    Summary: ${node.summary}
    Type: ${node.node_type}
    Content: ${node.content || 'No content available'}
    Human Rating: ${node.humanAverageRating || 0} (${node.humanRatingCount || 0} ratings)
    AI Rating: ${node.aiRating || 'None'}
    Has Images: ${node.has_image ? 'Yes' : 'No'}
    User Generated: ${node.user_generated ? 'Yes' : 'No'}`;
    }).join('\n\n');
    
    // Construct the prompt
    const prompt = `Given all and only the views on the question ${rootQuestionNode.summary} in the file, as well as all and only the reasons, objections and replies in the file exclusively, which of the below are the three philosophically strongest answers to the question ${rootQuestionNode.summary}. Do not consider anything not in the file. Please output exactly which of the views it is from the below in exactly the same format as below and nothing else.

${thesisList}
${userModifiedNodeData}`;
    
    console.log('Calling OpenAI API for This House Believes with prompt length:', prompt.length);
    
    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
    //const response = await fetch('http://mike:8080/v1/chat/completions', { EXOLABS LOCAL DEEPSEEK R1
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful AI assistant that analyzes philosophical positions and can determine the strongest answers to a question based on reasoning, evidence, and user ratings.'
          },
          { 
            role: 'user', 
            content: prompt 
          }
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || '';
    
    // Parse the response to extract the three beliefs
    return parseBeliefs(responseText, thesisNodes);
    
  } catch (error) {
    console.error('Error generating This House Believes statements:', error);
    throw error;
  }
};

/**
 * Parses the GPT response to extract structured belief data
 * @param {string} responseText - Raw GPT response
 * @param {Array} thesisNodes - Array of thesis nodes for matching
 * @returns {Array} Array of belief objects
 */
function parseBeliefs(responseText, thesisNodes) {
  try {
    // Split the response into lines to extract thesis statements
    const lines = responseText.split('\n').filter(line => line.trim().length > 0);
    
    // Extract the thesis titles from the response
    const beliefs = [];
    
    // Use regex to try to extract titles that match our thesis nodes
    for (const line of lines) {
      // Match thesis titles either as direct matches or as formatted entries
      for (const thesis of thesisNodes) {
        // Check if the line contains the thesis summary (case insensitive)
        if (line.toLowerCase().includes(thesis.summary.toLowerCase())) {
          // Find the matching thesis node
          beliefs.push({
            title: thesis.summary,
            description: thesis.content || 'No content available',
            confidence: Math.round(70 + beliefs.length * 5), // Descending confidence
            supporting_nodes: Math.round(5 - beliefs.length), // Descending support
            node_id: thesis.id // Store the node ID for navigation
          });
          
          // Only match one thesis per line
          break;
        }
      }
      
      // Stop after we find 3 beliefs
      if (beliefs.length >= 3) {
        break;
      }
    }
    
    // If we couldn't find 3 beliefs, fall back to the top 3 thesis nodes
    if (beliefs.length < 3) {
      // Sort thesis nodes by humanAverageRating (if available) or aiRating
      const sortedThesis = thesisNodes.sort((a, b) => {
        const aRating = a.humanAverageRating || a.aiRating || 0;
        const bRating = b.humanAverageRating || b.aiRating || 0;
        return bRating - aRating;
      });
      
      // Add the top-rated thesis nodes until we have 3
      for (let i = 0; i < sortedThesis.length && beliefs.length < 3; i++) {
        // Check if we've already included this thesis
        if (!beliefs.some(belief => belief.node_id === sortedThesis[i].id)) {
          beliefs.push({
            title: sortedThesis[i].summary,
            description: sortedThesis[i].content || 'No content available',
            confidence: Math.round(70 + beliefs.length * 5),
            supporting_nodes: Math.round(5 - beliefs.length),
            node_id: sortedThesis[i].id
          });
        }
      }
    }
    
    return beliefs;
    
  } catch (error) {
    console.error('Error parsing beliefs:', error);
    // Fallback to basic structure if parsing fails
    return [
      {
        title: "Position 1",
        description: "The analysis could not be properly parsed, but strong positions were identified.",
        confidence: 70,
        supporting_nodes: 5
      },
      {
        title: "Position 2",
        description: "The analysis could not be properly parsed, but strong positions were identified.",
        confidence: 65,
        supporting_nodes: 4
      },
      {
        title: "Position 3",
        description: "The analysis could not be properly parsed, but strong positions were identified.",
        confidence: 60,
        supporting_nodes: 3
      }
    ];
  }
}

// Create a service object with the exported functions
const thisHouseBelievesService = {
  getUserModifiedNodes,
  generateThisHouseBelieves,
  getAllThesisNodes,
  getRootQuestionNode
};

// Export the service object as default
export default thisHouseBelievesService;