/**
 * Listener for messages from content scripts.
 * Handles the "generate" type to create a draft reply and "getSettings" to retrieve user settings.
 */
import { getSettings } from './utils/storage.js';

/**
 * Calls the OpenAI API to generate a response based on the provided prompt.
 * @param {string} apiKey - The OpenAI API key.
 * @param {string} model - The model to use (e.g., 'gpt-4.1').
 * @param {string} prompt - The prompt to send to the API.
 * @returns {Promise<string>} - The generated text response.
 * @throws {Error} - If the API request fails.
 */
async function callOpenAI(apiKey, model, prompt) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: 'You are an email assistant that helps draft professional, contextually appropriate replies.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      throw new Error('Invalid response format from OpenAI API');
    }

    return data.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Creates a prompt using the template from settings, replacing placeholders with actual content.
 * @param {string} template - The prompt template with placeholders.
 * @param {string} bulletPoints - The user's talking points.
 * @param {string} emailContext - The context of the email being replied to.
 * @returns {string} - The complete prompt for the AI.
 */
function createPrompt(template, bulletPoints, emailContext) {
  let prompt = template;
  
  // Replace placeholders with actual content
  prompt = prompt.replace(/\[Bullet_points\]/g, bulletPoints);
  prompt = prompt.replace(/\[Email_context\]/g, emailContext);
  
  return prompt;
}

/**
 * Handles incoming messages from content scripts.
 * @param {object} message - The message object.
 * @param {object} sender - Information about the sender.
 * @param {function} sendResponse - Function to send a response.
 * @returns {boolean|undefined} - True to keep the message channel open for async response.
 */
async function handleMessage(message, sender, sendResponse) {
  console.log('Background script received message:', message);

  try {
    if (message.type === 'getSettings') {
      // Handle settings retrieval
      const settings = await getSettings();
      sendResponse({ success: true, settings });
      return; // Handled by async/await
    } else if (message.type === 'generate') {
      // Get user settings (still needed for model and template)
      const settings = await getSettings();

      // TEMP: Hardcode API Key for testing - REMEMBER TO REMOVE THIS
      const apiKey = "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";
      // We use the hardcoded apiKey below, but first check if settings were fetched
      if (!settings) { 
        sendResponse({ success: false, error: 'Could not retrieve extension settings.' });
        return;
      }
      // Original check was for settings.apiKey, which we are overriding.
      // Optional: Could add a check here if the hardcoded key itself is empty, but it's fixed for now.
      // if (!apiKey) { ... }
      
      // Create prompt from template and user input
      const { bulletPoints, emailContext } = message;
      const prompt = createPrompt(settings.promptTemplate, bulletPoints, emailContext);
      
      console.log('Generated prompt for OpenAI:', prompt);
      
      try {
        // Call OpenAI API using the hardcoded key
        const draftText = await callOpenAI(apiKey, settings.model, prompt);
        
        // Send successful response with generated draft
        sendResponse({ success: true, draft: draftText });
        console.log('Draft sent to content script.');
      } catch (error) {
        console.error('Error during OpenAI call:', error);
        sendResponse({ success: false, error: `Error generating draft: ${error.message}` });
      }
      
      return; // Handled by async/await
    } else {
      console.log('Background script received unknown message type:', message.type);
      sendResponse({ success: false, error: 'Unknown message type' });
    }
  } catch (error) {
    console.error('Error handling message:', error);
    sendResponse({ success: false, error: `Error: ${error.message}` });
  }
}

// Add message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle the message asynchronously and keep the messaging channel open
  handleMessage(message, sender, sendResponse);
  return true; // Keep the messaging channel open for the async response
});

console.log('Background service worker started.'); 