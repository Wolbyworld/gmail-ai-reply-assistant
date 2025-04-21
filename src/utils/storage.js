/**
 * Storage key for extension settings.
 */
const SETTINGS_KEY = 'ai-reply.settings';

/**
 * Default settings values.
 */
const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'gpt-4.1', // Assuming a default model from the spec
  promptTemplate: `Write a draft response to the emails below in the context. Keep it simple, respect my tone (normally informal) and the language of the email chain.\n\nThese are talking points:\n[Bullet_points]\n\nEmail context:\n[Email_context]`,
  improvePromptTemplate: `Correct typos and improve the message, maintaining the tone and length, keeping in mind the conversation context (if available), and the language of the draft. The selected text to improve is:\n\n[Selected_text]\n\nConversation context (if any):\n[Email_context]`
};

/**
 * Retrieves settings from chrome.storage.sync.
 * Merges stored settings with defaults.
 * @returns {Promise<object>} A promise that resolves with the settings object.
 */
export async function getSettings() {
  try {
    // Use an empty object as default for chrome.storage.sync.get
    const result = await chrome.storage.sync.get({ [SETTINGS_KEY]: {} });
    const storedSettings = result[SETTINGS_KEY] || {};
    // Merge stored settings with defaults, ensuring all keys are present
    return { ...DEFAULT_SETTINGS, ...storedSettings };
  } catch (error) {
    console.error('Error getting settings:', error);
    // Return defaults in case of error
    return { ...DEFAULT_SETTINGS }; 
  }
}

/**
 * Saves partial settings to chrome.storage.sync.
 * Merges the partial settings with the currently stored settings before saving.
 * @param {object} partialSettings - An object containing the settings to update.
 * @returns {Promise<boolean>} A promise that resolves with true on success, false on failure.
 */
export async function setSettings(partialSettings) {
  if (typeof partialSettings !== 'object' || partialSettings === null) {
    console.error('Invalid partialSettings provided.', partialSettings);
    return false;
  }

  try {
    // First, get the current settings to merge with
    const currentSettings = await getSettings();
    const newSettings = { ...currentSettings, ...partialSettings };
    
    // Save the merged settings object
    await chrome.storage.sync.set({ [SETTINGS_KEY]: newSettings });
    console.log('Settings saved successfully:', newSettings);
    return true;
  } catch (error) {
    console.error('Error setting settings:', error);
    return false;
  }
} 