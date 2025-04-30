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

/**
 * Example backend implementation (Node.js/Express)
 * 
 * This is not meant to be included in your frontend code,
 * but is provided as a reference for implementing your backend:
 * 
 * ```javascript
 * // Example backend code (Node.js/Express)
 * const express = require('express');
 * const OpenAI = require('openai');
 * const app = express();
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 * 
 * app.post('/api/explanation', async (req, res) => {
 *   try {
 *     const { prompt } = req.body;
 *     
 *     // Set appropriate headers for streaming
 *     res.setHeader('Content-Type', 'text/event-stream');
 *     res.setHeader('Cache-Control', 'no-cache');
 *     res.setHeader('Connection', 'keep-alive');
 *     
 *     // Call OpenAI API with streaming
 *     const stream = await openai.chat.completions.create({
 *       model: 'gpt-4o',
 *       messages: [{ role: 'user', content: prompt }],
 *       stream: true,
 *     });
 *     
 *     // Stream the response to the client
 *     for await (const chunk of stream) {
 *       const content = chunk.choices[0]?.delta?.content || '';
 *       if (content) {
 *         res.write(content);
 *       }
 *     }
 *     
 *     res.end();
 *   } catch (error) {
 *     console.error('Error generating explanation:', error);
 *     res.status(500).json({ message: error.message });
 *   }
 * });
 * 
 * app.listen(3001, () => {
 *   console.log('API server listening on port 3001');
 * });
 * ```
 */