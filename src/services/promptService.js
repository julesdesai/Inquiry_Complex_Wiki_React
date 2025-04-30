// src/services/promptService.js

/**
 * Fetches a prompt template from a text file and fills it with data
 * @param {string} templatePath - Path to the template file
 * @param {Object} data - Data to fill the template with
 * @returns {Promise<string>} - The filled template
 */
export const getFilledPromptTemplate = async (templatePath, data) => {
    try {
      // Fetch the template file
      const response = await fetch(templatePath);
      if (!response.ok) {
        throw new Error(`Failed to fetch template: ${response.status} ${response.statusText}`);
      }
      
      // Get the template content
      const templateContent = await response.text();
      
      // Replace placeholders with actual data
      const filledTemplate = templateContent
        .replace(/{{summary}}/g, data.summary || '')
        .replace(/{{content}}/g, data.content
          .replace(/{/g, '')
          .replace(/}/g, '')
          .replace(/\s+/g, ' ')
          .trim() || '');
      
      return filledTemplate;
    } catch (error) {
      console.error('Error loading prompt template:', error);
      throw error;
    }
  };
  
  export default {
    getFilledPromptTemplate
  };