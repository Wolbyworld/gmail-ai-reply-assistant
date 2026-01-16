/**
 * Listener for messages from content scripts.
 * Handles the "generate" type to create a draft reply and "getSettings" to retrieve user settings.
 */
console.log('Background script starting initialization... v0.7.8');

// Imports must be at the top level
import { getSettings } from './utils/storage.js';
import { BACKEND_URL, BACKEND_SECRET } from './config.js';

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
   * Calls the Luzia backend API to generate a response.
   * @param {string} model - The model to use (e.g., 'gpt-5-mini').
   * @param {string} instructions - System instructions/prompt.
   * @param {string} input - The user input text.
   * @param {string} reasoningEffort - Optional reasoning effort level.
   * @returns {Promise<string>} - The generated text response.
   * @throws {Error} - If the API request fails.
   */
  async function callBackend(model, instructions, input, reasoningEffort) {
    try {
      const body = {
        model: model,
        instructions: instructions,
        input: input,
        max_output_tokens: 1000,
        ...(reasoningEffort ? { reasoning: { effort: reasoningEffort } } : {})
      };

      const response = await fetch(`${BACKEND_URL}/v1/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Luzia-Secret': BACKEND_SECRET
        },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 401) {
          throw new Error('Authentication failed - contact admin');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded - try again later');
        }
        throw new Error(`Backend error (${response.status}): ${errorText}`);
      }

      const data = await response.json();

      if (!data.output_text) {
        throw new Error('Invalid response format from backend API');
      }

      return data.output_text.trim();
    } catch (error) {
      console.error('Error calling backend API:', error);
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
        // Get user settings (needed for model and template)
        const settings = await getSettings();

        if (!settings) {
          sendResponse({ success: false, error: 'Could not retrieve extension settings.' });
          return;
        }

        // Create prompt from template and user input
        const { bulletPoints, emailContext } = message;
        const userInput = createPrompt(settings.promptTemplate, bulletPoints, emailContext);
        const systemInstructions = 'You write clear, natural emails. Match the user\'s tone and language. Be concise.';

        console.log('Generated prompt for backend:', userInput);

        try {
          // Call backend API using model from settings
          const draftText = await callBackend(
            settings.composeModel,
            systemInstructions,
            userInput,
            settings.composeReasoningEffort
          );

          // Send successful response with generated draft
          sendResponse({ success: true, draft: draftText });
          console.log('Draft sent to content script.');
        } catch (error) {
          console.error('Error during backend call:', error);
          sendResponse({ success: false, error: `Error generating draft: ${error.message}` });
        }

        return; // Handled by async/await
      } else if (message.type === 'IMPROVE_TEXT') {
        // --- Improve Text Logic ---
        iconState = 'loading';
        await updateActionIcon();
        const settings = await getSettings();

        if (!settings) {
          iconState = 'error';
          await updateActionIcon();
          sendResponse({ success: false, error: 'Could not retrieve extension settings.' });
          return;
        }
        if (!settings.improvePromptTemplate) {
          iconState = 'error';
          await updateActionIcon();
          sendResponse({ success: false, error: 'Improve text prompt template is missing. Please check extension options.' });
          return;
        }

        // Ensure generic prompt template exists, using default if necessary (safety check)
        if (!settings.genericImprovePromptTemplate) {
          console.warn('Generic improve prompt template missing, using default.');
        }

        const { selectedText, context, source } = message;

        // Select the appropriate template based on the source
        const templateToUse = source === 'gmail'
            ? settings.improvePromptTemplate
            : settings.genericImprovePromptTemplate;

        // Select the appropriate model based on the source
        const modelToUse = source === 'gmail'
            ? settings.gmailImproveModel
            : settings.generalImproveModel;

        const userInput = createImprovePrompt(templateToUse, selectedText, context, source);
        const systemInstructions = 'You are a writing assistant. Improve the text while maintaining tone and meaning.';
        console.log('Generated prompt for Improve Text:', userInput);

        try {
          // Use the selected model for the backend call with per-source effort
          const effortToUse = source === 'gmail' ? settings.improveReasoningEffort : settings.generalImproveEffort;
          const improvedText = await callBackend(
            modelToUse,
            systemInstructions,
            userInput,
            effortToUse
          );
          iconState = 'idle';
          await updateActionIcon();
          // Send response back in the format expected by content script
          sendResponse({ success: true, type: 'IMPROVE_TEXT_RESULT', text: improvedText, source: source });
          console.log('Improved text sent to content script.');
        } catch (error) {
          console.error('Error during Improve Text backend call:', error);
          iconState = 'error';
          await updateActionIcon();
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
              iconState = 'inactive';
              await updateActionIcon(); // Bug #4 fix: await icon update
          }
        } else if (command === 'improve_text') {
          await chrome.tabs.sendMessage(targetTabId, { type: 'TRIGGER_IMPROVE' });
          console.log('TRIGGER_IMPROVE message sent.');
        }
      } catch (error) {
        console.error(`Error sending command trigger message to tab ${targetTabId}:`, error);
        iconState = 'error';
        await updateActionIcon(); // Bug #4 fix: await icon update
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