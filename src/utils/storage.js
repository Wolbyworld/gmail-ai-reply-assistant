/**
 * Storage key for extension settings.
 */
const SETTINGS_KEY = 'ai-reply.settings';

// 100X: Concise, clear rules, better output quality
const DEFAULT_GENERIC_IMPROVE_PROMPT = `Fix typos and grammar. Keep original style and meaning. Simplify when possible. Match punctuation style (add periods only if original has them). Follow <instructions> if present.

[Selected_text]`

/**
 * Default settings values.
 */
const DEFAULT_SETTINGS = {
  apiKey: '',
  // Legacy single-model key retained for backward compatibility
  model: 'gpt-5-mini',
  // New per-feature models default to gpt-5-mini (lower latency)
  composeModel: 'gpt-5-mini',
  gmailImproveModel: 'gpt-5-mini',
  generalImproveModel: 'gpt-5-mini',
  // Per-feature reasoning effort (default minimal)
  composeReasoningEffort: 'minimal',
  improveReasoningEffort: 'minimal',
  generalImproveEffort: 'minimal',
  // Prompts (100X: Clearer structure, better results, less tokens)
  promptTemplate: `Draft email reply using talking points below. Match language and informal tone from context. Be concise. Follow <instructions> if present. Sign "Álvaro" if appropriate.

Talking points:
[Bullet_points]

Context:
[Email_context]`,
  improvePromptTemplate: `Fix typos and improve clarity. Keep tone, length, and language from context.

Text:
[Selected_text]

Context:
[Email_context]`,
  genericImprovePromptTemplate: DEFAULT_GENERIC_IMPROVE_PROMPT
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