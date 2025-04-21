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
 * Creates a prompt for the "improve text" feature using the specific template.
 * @param {string} template - The improve text prompt template.
 * @param {string} selectedText - The text selected by the user.
 * @param {string} emailContext - The context of the email thread.
 * @returns {string} - The complete prompt for the AI.
 */
function createImprovePrompt(template, selectedText, emailContext) {
  let prompt = template;
  prompt = prompt.replace(/\[Selected_text\]/g, selectedText);
  prompt = prompt.replace(/\[Email_context\]/g, emailContext || 'No conversation context available.'); // Handle cases with no context
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
      // Get user settings (needed for model, template, AND API key)
      const settings = await getSettings();

      // Check if settings were fetched and API key exists
      if (!settings) { 
        sendResponse({ success: false, error: 'Could not retrieve extension settings.' });
        return;
      }
      if (!settings.apiKey) {
        sendResponse({ success: false, error: 'API Key is missing. Please set it in the extension options.' });
        return;
      }
      
      // Create prompt from template and user input
      const { bulletPoints, emailContext } = message;
      const prompt = createPrompt(settings.promptTemplate, bulletPoints, emailContext);
      
      console.log('Generated prompt for OpenAI:', prompt);
      
      try {
        // Call OpenAI API using the key from settings
        const draftText = await callOpenAI(settings.apiKey, settings.model, prompt);
        
        // Send successful response with generated draft
        sendResponse({ success: true, draft: draftText });
        console.log('Draft sent to content script.');
      } catch (error) {
        console.error('Error during OpenAI call:', error);
        sendResponse({ success: false, error: `Error generating draft: ${error.message}` });
      }
      
      return; // Handled by async/await
    } else if (message.type === 'IMPROVE_TEXT') {
      // --- New Improve Text Logic --- 
      const settings = await getSettings();

      if (!settings) { 
        sendResponse({ success: false, error: 'Could not retrieve extension settings.' });
        return;
      }
      if (!settings.apiKey) {
        sendResponse({ success: false, error: 'API Key is missing. Please set it in the extension options.' });
        return;
      }
      if (!settings.improvePromptTemplate) {
        sendResponse({ success: false, error: 'Improve text prompt template is missing. Please check extension options.' });
        return;
      }

      const { selectedText, context } = message;
      const improvePrompt = createImprovePrompt(settings.improvePromptTemplate, selectedText, context);
      console.log('Generated prompt for Improve Text:', improvePrompt);

      try {
        const improvedText = await callOpenAI(settings.apiKey, settings.model, improvePrompt); // Using the same OpenAI call function
        sendResponse({ success: true, type: 'IMPROVE_TEXT_RESULT', text: improvedText });
        console.log('Improved text sent to content script.');
      } catch (error) {
        console.error('Error during Improve Text OpenAI call:', error);
        sendResponse({ success: false, error: `Error improving text: ${error.message}` });
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

// Listener for keyboard shortcuts defined in manifest.json
chrome.commands.onCommand.addListener(async (command) => {
  console.log(`Command received: ${command}`);

  // Find the active Gmail tab
  let activeGmailTabs = await chrome.tabs.query({
    active: true,
    url: "*://mail.google.com/*" // Ensure it's a Gmail tab
  });

  if (activeGmailTabs.length === 0) {
    console.log('Command ignored: No active Gmail tab found.');
    // Optionally, try finding the last focused Gmail window if no active tab matches
    activeGmailTabs = await chrome.tabs.query({
       lastFocusedWindow: true,
       url: "*://mail.google.com/*"
    });
    if (activeGmailTabs.length === 0) {
        console.log('Command ignored: No active or last focused Gmail tab found.');
        return;
    }
    // If found via last focused, use the first one that's likely visible
    // This is less reliable than active: true but better than nothing
    console.log('Using last focused Gmail tab as target.');
  }

  const targetTab = activeGmailTabs[0];
  if (!targetTab || !targetTab.id) {
    console.error('Could not determine target tab ID.');
    return;
  }

  console.log(`Sending trigger message to tab ID: ${targetTab.id}`);

  // Send a message to the content script in that tab
  try {
    if (command === 'generate_reply') {
      await chrome.tabs.sendMessage(targetTab.id, { type: 'TRIGGER_GENERATE' });
      console.log('TRIGGER_GENERATE message sent.');
    } else if (command === 'improve_text') {
      await chrome.tabs.sendMessage(targetTab.id, { type: 'TRIGGER_IMPROVE' });
      console.log('TRIGGER_IMPROVE message sent.');
    }
  } catch (error) {
    console.error(`Error sending command trigger message to tab ${targetTab.id}:`, error);
    // This often happens if the content script hasn't loaded yet or the tab was closed
    // You might want to inform the user or retry if applicable
  }
});

console.log('Background service worker started.'); 