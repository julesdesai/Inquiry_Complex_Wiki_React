// src/api/explanationApi.js
/**
 * This file provides functions for connecting to GPT-4o via your backend API
 * You'll need to implement a backend endpoint that calls OpenAI's API
 * This is just a reference implementation
 */

// The base URL for your backend API
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

/**
 * Requests an explanation from GPT-4o via your backend API
 * 
 * @param {string} prompt - The prompt to send to GPT-4o
 * @returns {Promise<ReadableStream>} - A stream of the response text
 */
export const getExplanationStream = async (prompt) => {
  try {
    // Make a request to your backend API
    const response = await fetch(`${API_BASE_URL}/explanation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `API request failed with status ${response.status}`);
    }

    // Return the stream directly
    return response.body;
  } catch (error) {
    console.error('Error requesting explanation:', error);
    throw error;
  }
};
