import { getSettings, setSettings } from '../utils/storage.js';

// Define defaults directly in options for restore functionality
const DEFAULT_PROMPT_TEMPLATE = `Write a draft response to the emails below in the context. Keep it simple, respect my tone (informal) and the language of the email chain. Use paragraphs wisely, do not over index on them. User may leave specific instructions within <> notation, those are not part of the email but will give you info about how to redact it. Act on those instructions. Sign with Álvaro when appropriate. \n\nThese are talking points:\n[Bullet_points]\n\nEmail context:\n[Email_context]`;
const DEFAULT_IMPROVE_PROMPT_TEMPLATE = `Correct typos and improve the message, maintaining the tone and length, keeping in mind the conversation context (if available), and the language of the draft. The selected text to improve is:\n\n[Selected_text]\n\nConversation context (if any):\n[Email_context]`;
const DEFAULT_GENERIC_IMPROVE_PROMPT = `Act as a proofreading expert. Carefully review the following text for spelling mistakes, typos, and minor grammatical errors. Correct any issues you find, but do not change the style or meaning of the original message. Return only the corrected version. Simplify when possible, less is more. Do not end sentences with a "." unless there is one already in the selected text. User may leave specific instructions within <> notation. Act on those instructions. \n\n[Selected_text]`
const DEFAULT_COMPOSE_MODEL = 'gpt-4.1';
const DEFAULT_GMAIL_IMPROVE_MODEL = 'gpt-4.1';
const DEFAULT_GENERAL_IMPROVE_MODEL = 'gpt-4.1';

// DOM Elements
const form = document.getElementById('settings-form');
const apiKeyInput = document.getElementById('api-key');
const composeModelSelect = document.getElementById('compose-model');
const gmailImproveModelSelect = document.getElementById('gmail-improve-model');
const generalImproveModelSelect = document.getElementById('general-improve-model');
const promptTemplateTextarea = document.getElementById('prompt-template');
const improvePromptTemplateTextarea = document.getElementById('improve-prompt-template');
const genericImprovePromptTextarea = document.getElementById('generic-improve-prompt');
const restoreButton = document.getElementById('restore-defaults');
const statusMessageDiv = document.getElementById('status-message');

/**
 * Loads settings and populates the form.
 */
async function loadSettings() {
  console.log('Loading settings...');
  try {
    const settings = await getSettings();
    apiKeyInput.value = settings.apiKey ?? '';
    composeModelSelect.value = settings.composeModel ?? DEFAULT_COMPOSE_MODEL;
    gmailImproveModelSelect.value = settings.gmailImproveModel ?? DEFAULT_GMAIL_IMPROVE_MODEL;
    generalImproveModelSelect.value = settings.generalImproveModel ?? DEFAULT_GENERAL_IMPROVE_MODEL;
    promptTemplateTextarea.value = settings.promptTemplate ?? DEFAULT_PROMPT_TEMPLATE;
    improvePromptTemplateTextarea.value = settings.improvePromptTemplate ?? DEFAULT_IMPROVE_PROMPT_TEMPLATE;
    genericImprovePromptTextarea.value = settings.genericImprovePromptTemplate ?? DEFAULT_GENERIC_IMPROVE_PROMPT;
    console.log('Settings loaded into form.');
  } catch (error) {
    console.error('Error loading settings into form:', error);
    displayStatus('Error loading settings.', true);
  }
}

/**
 * Saves settings from the form.
 * @param {Event} event - The form submit event.
 */
async function saveSettings(event) {
  event.preventDefault(); // Prevent default form submission
  console.log('Saving settings...');

  const newSettings = {
    apiKey: apiKeyInput.value.trim(),
    composeModel: composeModelSelect.value,
    gmailImproveModel: gmailImproveModelSelect.value,
    generalImproveModel: generalImproveModelSelect.value,
    promptTemplate: promptTemplateTextarea.value,
    improvePromptTemplate: improvePromptTemplateTextarea.value,
    genericImprovePromptTemplate: genericImprovePromptTextarea.value
  };

  try {
    const success = await setSettings(newSettings);
    if (success) {
      displayStatus('Settings saved successfully!');
      console.log('Settings saved.');
    } else {
      displayStatus('Failed to save settings.', true);
       console.error('setSettings returned false.');
    }
  } catch (error) {
    displayStatus('Error saving settings.', true);
    console.error('Error during setSettings call:', error);
  }
}

/**
 * Restores the prompt template and model fields to their default values.
 * Does not save immediately.
 */
function restoreDefaults() {
  console.log('Restoring default settings in form...');
  // We only restore the prompt and model, not the API key
  composeModelSelect.value = DEFAULT_COMPOSE_MODEL;
  gmailImproveModelSelect.value = DEFAULT_GMAIL_IMPROVE_MODEL;
  generalImproveModelSelect.value = DEFAULT_GENERAL_IMPROVE_MODEL;
  promptTemplateTextarea.value = DEFAULT_PROMPT_TEMPLATE;
  improvePromptTemplateTextarea.value = DEFAULT_IMPROVE_PROMPT_TEMPLATE;
  genericImprovePromptTextarea.value = DEFAULT_GENERIC_IMPROVE_PROMPT;
  displayStatus('Defaults loaded. Click Save to apply.'); 
}

/**
 * Displays a status message to the user.
 * @param {string} message - The message to display.
 * @param {boolean} [isError=false] - Whether the message is an error.
 */
function displayStatus(message, isError = false) {
  statusMessageDiv.textContent = message;
  statusMessageDiv.className = isError ? 'status error' : 'status success';
  statusMessageDiv.style.display = 'block'; // Make it visible

  // Optionally hide after a delay
  setTimeout(() => {
    statusMessageDiv.style.display = 'none';
    statusMessageDiv.textContent = '';
    statusMessageDiv.className = 'status';
  }, 3000); // Hide after 3 seconds
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', loadSettings);
form.addEventListener('submit', saveSettings);
restoreButton.addEventListener('click', restoreDefaults);

console.log('Options script loaded.'); 