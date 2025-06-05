// src/services/imageGenerationService.js
import { uploadImage } from '../firebase';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';

/**
 * Generates an image using OpenAI's API, uploads it to Firebase,
 * and updates the document with has_image=true
 * @param {string} nodeId - The ID of the node to associate the image with
 * @param {string} prompt - The prompt to generate the image from
 * @param {string} collectionName - The collection name in Firebase
 * @returns {Promise<Object>} - The uploaded image metadata
 */
export const generateAndUploadImage = async (nodeId, prompt, collectionName = 'nodes') => {
  try {
    // Get API key from environment variables
    const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
    
    if (!apiKey) {
      throw new Error('OpenAI API key not configured. Please set REACT_APP_OPENAI_API_KEY in your environment variables.');
    }
    
    console.log('Generating image with prompt length:', prompt.length);
    
    // Call OpenAI API to generate the image
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: prompt,
        n: 1,
        size: "1024x1024",
        moderation: "low"
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `API request failed with status ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data.data || !data.data[0] || !data.data[0].b64_json) {
      throw new Error('Invalid response from OpenAI API');
    }
    
    // Convert base64 to blob
    const base64String = data.data[0].b64_json;
    const byteCharacters = atob(base64String);
    const byteArrays = [];
    
    for (let i = 0; i < byteCharacters.length; i += 1024) {
      const slice = byteCharacters.slice(i, i + 1024);
      const byteNumbers = new Array(slice.length);
      
      for (let j = 0; j < slice.length; j++) {
        byteNumbers[j] = slice.charCodeAt(j);
      }
      
      byteArrays.push(new Uint8Array(byteNumbers));
    }
    
    const blob = new Blob(byteArrays, { type: 'image/png' });
    
    // Create a File object from the blob
    const timestamp = new Date().getTime();
    const filename = `ai-generated-${timestamp}.png`;
    const file = new File([blob], filename, { type: 'image/png' });
    
    // Upload the image using the existing Firebase function
    const uploadResult = await uploadImage(nodeId, file, collectionName);
    
    // After successful upload, update the document with has_image=true
    const db = getFirestore();
    const docRef = doc(db, collectionName, nodeId);
    await updateDoc(docRef, {
      has_image: true
    });
    
    console.log(`Updated document ${nodeId} in collection ${collectionName} with has_image=true`);
    
    return uploadResult;
  } catch (error) {
    console.error('Error generating and uploading image:', error);
    throw error;
  }
};

export default {
  generateAndUploadImage
};