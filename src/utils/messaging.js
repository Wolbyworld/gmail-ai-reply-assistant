/**
 * Messaging utilities with timeout support
 * Bug #8 fix: Wrapper for chrome.runtime.sendMessage with timeout
 */

/**
 * Send a message to the background script with timeout support
 * @param {Object} message - The message to send
 * @param {number} timeout - Timeout in milliseconds (default: 30000ms = 30s)
 * @returns {Promise<any>} - The response from the background script
 * @throws {Error} - If timeout occurs or message fails
 */
export async function sendMessageWithTimeout(message, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Message timeout after ${timeout}ms for type: ${message.type}`));
    }, timeout);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(response);
      });
    } catch (error) {
      clearTimeout(timeoutId);
      reject(error);
    }
  });
}

/**
 * Send a message with retry logic
 * @param {Object} message - The message to send
 * @param {Object} options - Options {timeout, retries, retryDelay}
 * @returns {Promise<any>} - The response from the background script
 */
export async function sendMessageWithRetry(message, options = {}) {
  const {
    timeout = 30000,
    retries = 2,
    retryDelay = 1000
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await sendMessageWithTimeout(message, timeout);
    } catch (error) {
      lastError = error;
      console.warn(`[sendMessageWithRetry] Attempt ${attempt + 1}/${retries + 1} failed:`, error.message);

      // Don't delay after the last attempt
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error(`Failed after ${retries + 1} attempts: ${lastError.message}`);
}
