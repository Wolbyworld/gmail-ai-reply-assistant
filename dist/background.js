/**
 * Listener for messages from content scripts.
 * Handles the "generate" type to create a draft reply and "getSettings" to retrieve user settings.
 */
console.log('Background script starting initialization...');

// Imports must be at the top level
import { getSettings } from './utils/storage.js';

// Wrap in try/catch to catch any initialization errors
try {
  // --- Icon State Management ---

  console.log('Setting up icon state management...');

  const defaultIconPath = "icons/logo.png"; // Assuming your default icon is here
  let iconState = 'idle'; // Can be 'idle', 'loading', 'error', 'inactive'
  let errorTimeout = null; // Timeout for clearing temporary states like 'inactive'

  async function updateActionIcon() {
    try {
      clearTimeout(errorTimeout);
      errorTimeout = null;
      
      // Check if chrome.action API is available
      if (!chrome.action) {
        console.warn('[updateActionIcon] chrome.action API not available, skipping icon update');
        return;
      }
      
      if (iconState === 'loading') {
        await chrome.action.setIcon({ path: defaultIconPath }); // Keep default icon for now
        await chrome.action.setBadgeText({ text: '...' });
        await chrome.action.setBadgeBackgroundColor({ color: '#FFA500' }); // Orange
        await chrome.action.setTitle({ title: 'Processing...' });
      } else if (iconState === 'error') {
        await chrome.action.setIcon({ path: defaultIconPath }); // Keep default icon
        await chrome.action.setBadgeText({ text: '!' });
        await chrome.action.setBadgeBackgroundColor({ color: '#FF0000' }); // Red
        await chrome.action.setTitle({ title: 'Error occurred. Click for details (if implemented)' });
      } else if (iconState === 'inactive') {
        await chrome.action.setIcon({ path: defaultIconPath }); // Keep default icon
        await chrome.action.setBadgeText({ text: '' }); // Maybe a subtle grey icon later? For now, clear badge.
        // await chrome.action.setBadgeBackgroundColor({ color: '#808080' }); // Grey
        await chrome.action.setTitle({ title: 'No text selected' });
        // Set a timeout to revert to idle
        errorTimeout = setTimeout(() => {
            if (iconState === 'inactive') { // Check if still inactive
                iconState = 'idle';
                updateActionIcon();
            }
        }, 2000); // Revert after 2 seconds
      } else { // idle
        await chrome.action.setIcon({ path: defaultIconPath });
        await chrome.action.setBadgeText({ text: '' });
        await chrome.action.setTitle({ title: 'Gmail AI Reply Assistant' }); // Default title
      }
      console.log(`[updateActionIcon] Icon state set to: ${iconState}`);
    } catch (error) {
      console.error('[updateActionIcon] Error setting action icon:', error.message);
    }
  }

  // Initialize icon on startup
  try {
    updateActionIcon();
    console.log('Icon state initialized.');
  } catch (error) {
    console.error('Error initializing icon state:', error.message);
  }

  // --- End Icon State Management ---

  /**
   * Calls the OpenAI API to generate a response based on the provided prompt.
   * @param {string} apiKey - The OpenAI API key.
   * @param {string} model - The model to use (e.g., 'gpt-4.1').
   * @param {string} prompt - The prompt to send to the API.
   * @returns {Promise<string>} - The generated text response.
   * @throws {Error} - If the API request fails.
   */
  async function callOpenAI(apiKey, model, prompt, reasoningEffort) {
    async function doRequest(includeReasoning) {
      const body = {
        model: model,
        messages: [
          { role: 'system', content: 'You are an email assistant that helps draft professional, contextually appropriate replies.' },
          { role: 'user', content: prompt }
        ],
        // For newer models use max_completion_tokens; omit temperature (some models only support default)
        max_completion_tokens: 1000,
        ...(includeReasoning && reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {})
      };
      return fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
    }
    try {
      // First attempt: include reasoning if provided
      let response = await doRequest(true);

      if (!response.ok) {
        const errorText = await response.text();
        // If reasoning parameter is unsupported, retry without it once
        if (response.status === 400 && /reasoning/i.test(errorText)) {
          response = await doRequest(false);
          if (!response.ok) {
            const retryText = await response.text();
            throw new Error(`OpenAI API error (${response.status}) after retry: ${retryText}`);
          }
        } else if (response.status === 400 && /temperature/i.test(errorText)) {
          // We already omit temperature; surface the error
          throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        } else {
          throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
        }
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
   * @param {string} source - The source of the request ('gmail' or 'generic').
   * @returns {string} - The complete prompt for the AI.
   */
  function createImprovePrompt(template, selectedText, emailContext, source) {
    let prompt = template;
    prompt = prompt.replace(/\[Selected_text\]/g, selectedText);
    
    if (source === 'gmail') {
        prompt = prompt.replace(/\[Email_context\]/g, emailContext || 'No conversation context available.');
    } else {
        // For generic source, remove or replace the context part of the template
        // Assuming the template might look like: "Improve text: [Selected_text] Context: [Email_context]"
        // A simple approach: replace the context placeholder and any preceding label/newline
        prompt = prompt.replace(/\n*Conversation context \(if any\):\n\[Email_context\]/gi, ''); 
        prompt = prompt.replace(/\[Email_context\]/g, 'Not applicable.'); // Fallback replacement
    }
    
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
          // Call OpenAI API using the key and specific model from settings
          const draftText = await callOpenAI(
            settings.apiKey,
            settings.composeModel,
            prompt,
            settings.composeReasoningEffort
          );
          
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
        iconState = 'loading';
        await updateActionIcon();
        const settings = await getSettings();

        if (!settings) { 
          iconState = 'error'; updateActionIcon();
          sendResponse({ success: false, error: 'Could not retrieve extension settings.' });
          return;
        }
        if (!settings.apiKey) {
          iconState = 'error'; updateActionIcon();
          sendResponse({ success: false, error: 'API Key is missing. Please set it in the extension options.' });
          return;
        }
        if (!settings.improvePromptTemplate) {
          iconState = 'error'; updateActionIcon();
          sendResponse({ success: false, error: 'Improve text prompt template is missing. Please check extension options.' });
          return;
        }

        // Ensure generic prompt template exists, using default if necessary (safety check)
        if (!settings.genericImprovePromptTemplate) {
          console.warn('Generic improve prompt template missing, using default.');
          settings.genericImprovePromptTemplate = DEFAULT_GENERIC_IMPROVE_PROMPT; // Use default defined in storage.js (or redefine here if not accessible)
        }

        const { selectedText, context, source } = message;

        // Select the appropriate template based on the source
        const templateToUse = source === 'gmail' 
            ? settings.improvePromptTemplate 
            : settings.genericImprovePromptTemplate;
        
        // Select the appropriate model based on the source
        let modelToUse;
        if (source === 'gmail') {
            modelToUse = settings.gmailImproveModel;
        } else { // generic
            modelToUse = settings.generalImproveModel;
        }

        const improvePrompt = createImprovePrompt(templateToUse, selectedText, context, source);
        console.log('Generated prompt for Improve Text:', improvePrompt);

        try {
          // Use the selected model for the OpenAI call with per-source effort
          const effortToUse = source === 'gmail' ? settings.improveReasoningEffort : settings.generalImproveEffort;
          const improvedText = await callOpenAI(
            settings.apiKey,
            modelToUse,
            improvePrompt,
            effortToUse
          );
          iconState = 'idle'; updateActionIcon(); // Reset icon on success before sending response
          // Send response back in the format expected by content script
          sendResponse({ success: true, type: 'IMPROVE_TEXT_RESULT', text: improvedText, source: source });
          console.log('Improved text sent to content script.');
        } catch (error) {
          console.error('Error during Improve Text OpenAI call:', error);
          iconState = 'error'; updateActionIcon();
          sendResponse({ success: false, error: `Error improving text: ${error.message}` });
        }
        return; // Handled by async/await
      } else if (message.type === 'SET_ICON_STATE') {
          if (['idle', 'loading', 'error', 'inactive'].includes(message.state)) {
              iconState = message.state;
              await updateActionIcon();
              sendResponse({success: true});
          } else {
               sendResponse({success: false, error: 'Invalid icon state'});
          }
          return; // Handled
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
    console.log('[Background Listener] Message received:', message, 'From:', sender.tab ? sender.tab.url : "extension");
    // Handle the message asynchronously and keep the messaging channel open
    handleMessage(message, sender, sendResponse);
    return true; // Keep the messaging channel open for the async response
  });

  // Self-test function to verify background script is running correctly
  function performSelfTest() {
    console.log('Background script self-test running...');
    try {
      // Test chrome.action API availability
      const actionAvailable = typeof chrome.action !== 'undefined';
      console.log('chrome.action API available:', actionAvailable);
      
      // Test storage API availability
      const storageAvailable = typeof chrome.storage !== 'undefined';
      console.log('chrome.storage API available:', storageAvailable);
      
      console.log('Self-test complete, background script appears operational.');
    } catch (error) {
      console.error('Self-test failed:', error.message);
    }
  }

  // Listener for keyboard shortcuts defined in manifest.json
  chrome.commands.onCommand.addListener(async (command) => {
    console.log(`Command received: ${command}`);

    try {
      // Find the currently active tab regardless of URL for generic improvement
      let [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true // Ensure it's in the current window
      });

      if (!activeTab || !activeTab.id) {
        console.error('Could not determine active tab ID.');
        return;
      }
      
      const targetTabId = activeTab.id;
      console.log(`Sending trigger message to active tab ID: ${targetTabId}`);

      // Send a message to the content script in that tab
      try {
        if (command === 'generate_reply') {
          // Only trigger generate if it's a Gmail URL
          if (activeTab.url && activeTab.url.startsWith('https://mail.google.com/')) {
              await chrome.tabs.sendMessage(targetTabId, { type: 'TRIGGER_GENERATE' });
              console.log('TRIGGER_GENERATE message sent.');
          } else {
              console.log('Generate Reply command ignored: Not a Gmail tab.');
              iconState = 'inactive'; updateActionIcon(); // Briefly show inactive
          }
        } else if (command === 'improve_text') {
          await chrome.tabs.sendMessage(targetTabId, { type: 'TRIGGER_IMPROVE' });
          console.log('TRIGGER_IMPROVE message sent.');
        }
      } catch (error) {
        console.error(`Error sending command trigger message to tab ${targetTabId}:`, error);
        iconState = 'error'; updateActionIcon(); // Show error state
      }
    } catch (error) {
      console.error('Error in commands.onCommand listener:', error);
    }
  });

  console.log('Background service worker started.');
  // Run self-test after a short delay
  setTimeout(performSelfTest, 500);

} catch (error) {
  // Global error handler for initialization errors
  console.error('CRITICAL ERROR: Background script initialization failed:');
  console.error(error);
  console.error('Stack trace:');
  console.error(error.stack);
} 