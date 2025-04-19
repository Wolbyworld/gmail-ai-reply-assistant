// Gmail utilities directly included in content script

/**
 * Returns a NodeList of Gmail compose window root elements using multiple selectors.
 * Gmail's DOM structure can change; this function uses multiple strategies to find compose windows.
 * @returns {NodeList} - Collection of compose window elements
 */
function getComposeWindows() {
  // Use multiple selectors to find compose windows in different Gmail versions/states
  // PRIORITIZE the contenteditable div with the correct aria-label and role
  const specificSelector = 'div[contenteditable="true"][role="textbox"][aria-label="Message Body"]';
  const selectors = [
    specificSelector,
    // Broader selectors as fallbacks
    '.Am.Al.editable[contenteditable="true"]', // Older class
    '[g_editable="true"][role="textbox"]', // Another Google attribute
    // Selectors targeting containers that *should* contain the specific div
    '.aoP .editable', // Common container for inline replies
    '.AD [contenteditable="true"][role="textbox"]' // Popup compose
  ];
  
  console.log('[getComposeWindows] Searching for compose windows using primary selectors...');

  // --- Removed the alternative methods (Send button, dialog, toolbar) for now to simplify ---
  // const bottomComposeWindows = [];
  // ... logic finding bottomComposeWindows ...
  // if (bottomComposeWindows.length > 0) { return bottomComposeWindows; }

  const combinedSelector = selectors.join(', ');
  let potentialWindows = Array.from(document.querySelectorAll(combinedSelector));
  
  console.log(`[getComposeWindows] Found ${potentialWindows.length} potential windows with primary selectors.`);

  // If primary selectors fail, try a slightly broader contenteditable search
  if (potentialWindows.length === 0) {
    console.warn('[getComposeWindows] Primary selectors failed. Trying broader contenteditable search...');
    const fallbackSelector = '[contenteditable="true"][role="textbox"]';
    potentialWindows = Array.from(document.querySelectorAll(fallbackSelector));
    console.log(`[getComposeWindows] Found ${potentialWindows.length} potential windows with fallback selector.`);
  }

  // Filter results: MUST be the specific contenteditable DIV
  const specificSelectorForFilter = 'div[contenteditable="true"][role="textbox"][aria-label="Message Body"]';
  console.log(`[getComposeWindows] Filtering ${potentialWindows.length} candidates strictly for selector: ${specificSelectorForFilter}`);

  const composeWindows = potentialWindows.filter(el => {
      if (!el.matches(specificSelectorForFilter)) {
          console.log('[getComposeWindows] Filtering out element (does NOT match specific selector):', el);
          return false;
      }
      
      // Basic visibility and size checks
      const rect = el.getBoundingClientRect();
      const isVisible = rect.width > 50 && rect.height > 30 && window.getComputedStyle(el).display !== 'none';
      if (!isVisible) {
          console.log('[getComposeWindows] Filtering out element (not visible/sized):', el);
          return false;
      }
      
      // Check context - must be within a known compose area parent
      const inComposeArea = !!el.closest('.AD, .aoP, .dw, form[target], .M9, .aO9');
      if (!inComposeArea) {
          console.log('[getComposeWindows] Filtering out element (not in known compose area):', el);
          return false;
      }

      console.log('[getComposeWindows] Keeping STRICTLY matched compose window:', el);
      return true;
  });

  console.log(`[getComposeWindows] Filtered to ${composeWindows.length} final compose windows (strict filter).`);
  return composeWindows;
}

/**
 * Helper function to check if an element is likely a compose window
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element is likely a compose window
 */
function isLikelyComposeWindow(element) {
  if (!element) return false;
  
  // First check: is it editable in some way?
  const isEditable = element.getAttribute('contenteditable') === 'true' || 
                     element.classList.contains('editable') ||
                     element.getAttribute('g_editable') === 'true' ||
                     element.getAttribute('aria-label') === 'Message Body' ||
                     element.getAttribute('role') === 'textbox';
                     
  if (!isEditable) {
    // If this element isn't directly editable, check if it contains an editable child
    const hasEditableChild = element.querySelector('[contenteditable="true"], [role="textbox"]');
    if (!hasEditableChild) return false;
  }
  
  // Check context - should be in a compose-related container
  // Look for various Gmail compose container indicators
  const inComposeArea = !!element.closest('[role="dialog"], .AD, .AO, [aria-label*="ompose"]') ||
                       !!element.closest('.M9, .a3s, .aO9, .ii.gt') ||
                       // Check for specific class names that might indicate a compose area
                       (element.className && /compose|editor|draft/i.test(element.className)) ||
                       // Check if in an iframe (Gmail sometimes uses iframes for compose)
                       (element.ownerDocument !== document);
  
  // Check size - compose windows should be reasonably sized
  const rect = element.getBoundingClientRect();
  
  // Gmail compose areas are typically at least 100px wide and 50px tall
  // But we'll be more lenient here - just need it to be visible
  const hasSubstantialSize = rect.width > 50 && rect.height > 30;
  
  // Check visibility
  const isVisible = rect.width > 0 && rect.height > 0 && 
                   window.getComputedStyle(element).display !== 'none' &&
                   window.getComputedStyle(element).visibility !== 'hidden';
  
  // Log more details for debugging if we have a potential candidate
  if (isEditable && hasSubstantialSize && isVisible) {
    console.log('Potential compose window found:', {
      element,
      rect: `${Math.round(rect.width)}x${Math.round(rect.height)}`,
      inComposeArea
    });
  }
  
  return (isEditable || element.querySelector('[contenteditable="true"]')) && hasSubstantialSize && isVisible;
}

/**
 * Inserts the AI-generated draft into a Gmail compose window and positions the cursor at the end.
 * The draft is appended directly after any existing content without adding blank lines.
 * 
 * @param {Element} composeWindow - The Gmail compose window element (from getComposeWindows)
 * @param {string} draftText - The text to insert
 * @return {boolean} - True if successful, false otherwise
 */
function appendDraft(composeWindow, draftText) {
  try {
    if (!composeWindow || !draftText) {
      console.error('appendDraft: Missing required parameters', { composeWindow, draftText });
      return false;
    }

    console.log('[appendDraft] Received composeWindow element (expected to be the editable div):', composeWindow);
    
    // Assume composeWindow is the correct editable div based on refined getComposeWindows
    const editableDiv = composeWindow;

    // Add a quick check to ensure it IS editable, just in case getComposeWindows slipped
    if (!editableDiv || editableDiv.getAttribute('contenteditable') !== 'true') {
        console.error('[appendDraft] Error: Received element is NOT contenteditable! This should not happen.', editableDiv);
        return false;
    }
    
    console.log('[appendDraft] Using received element as editable area:', editableDiv);

    // --- Prepare text for insertion --- 
    let textToInsert = '';
    const hasExistingContent = editableDiv.textContent.trim().length > 0;
    
    if (hasExistingContent) {
      const lastChar = editableDiv.textContent.slice(-1);
      if (lastChar !== ' ' && lastChar !== '\n') {
        textToInsert += ' '; // Add leading space if needed
      }
    }
    textToInsert += draftText; // Add the main draft text
    
    console.log('[appendDraft] Text to insert via execCommand:', JSON.stringify(textToInsert));

    // --- Insert text using execCommand --- 
    // Set focus BEFORE execCommand
    editableDiv.focus(); 
    
    // Use execCommand (deprecated but often works better for complex editors)
    const success = document.execCommand('insertText', false, textToInsert);

    if (!success) {
        console.error('[appendDraft] document.execCommand("insertText") failed. Trying appendChild as fallback...');
        // Fallback to previous appendChild method if execCommand fails
        const fragment = document.createDocumentFragment();
        const textNode = document.createTextNode(textToInsert); 
        fragment.appendChild(textNode);
        editableDiv.appendChild(fragment);
        
        // Try setting cursor again after appendChild
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(editableDiv);
        range.collapse(false); // Collapse to end
        selection.removeAllRanges();
        selection.addRange(range);
    } else {
        console.log('[appendDraft] document.execCommand("insertText") succeeded.');
    }

    // Dispatch events (might still be needed even with execCommand)
    try {
      let inputEvent = new Event('input', { bubbles: true });
      editableDiv.dispatchEvent(inputEvent);
      let changeEvent = new Event('change', { bubbles: true });
      editableDiv.dispatchEvent(changeEvent);
      console.log('[appendDraft] Dispatched input and change events.');
    } catch (eventError) {
      console.warn('[appendDraft] Could not dispatch input/change events:', eventError);
    }
    
    console.log('[appendDraft] Finished attempt to insert draft.');
    return true;
  } catch (error) {
    console.error('appendDraft: Error inserting draft', error);
    return false;
  }
}

/**
 * Displays an error banner inside the Gmail compose window.
 * The banner will appear at the top of the compose window and auto-dismiss after the specified timeout.
 * 
 * @param {Element} composeWindow - The Gmail compose window element (from getComposeWindows)
 * @param {string} message - The error message to display
 * @param {Object} options - Configuration options
 * @param {number} options.timeout - Auto-dismiss timeout in ms (default: 5000ms, set to 0 to disable)
 * @param {string} options.type - Banner type: 'error', 'warning', 'info' (default: 'error')
 * @return {Element} - The created banner element or null if creation failed
 */
function showBanner(composeWindow, message, options = {}) {
  try {
    if (!composeWindow || !message) {
      console.error('showBanner: Missing required parameters', { composeWindow, message });
      return null;
    }

    // Default options
    const defaultOptions = {
      timeout: 5000, // 5 seconds auto-dismiss (0 to disable)
      type: 'error'  // 'error', 'warning', or 'info'
    };
    
    const settings = { ...defaultOptions, ...options };
    
    // Create a container for the banner if it doesn't exist
    let bannerContainer = composeWindow.querySelector('.ai-reply-banner-container');
    if (!bannerContainer) {
      bannerContainer = document.createElement('div');
      bannerContainer.className = 'ai-reply-banner-container';
      bannerContainer.style.position = 'absolute';
      bannerContainer.style.top = '0';
      bannerContainer.style.left = '0';
      bannerContainer.style.right = '0';
      bannerContainer.style.zIndex = '1000';
      bannerContainer.style.display = 'flex';
      bannerContainer.style.flexDirection = 'column';
      bannerContainer.style.gap = '4px';
      bannerContainer.style.padding = '4px';
      composeWindow.style.position = 'relative'; // Ensure relative positioning for absolute banner
      composeWindow.insertBefore(bannerContainer, composeWindow.firstChild);
    }
    
    // Create the banner element
    const banner = document.createElement('div');
    banner.className = `ai-reply-banner ai-reply-banner-${settings.type}`;
    banner.setAttribute('role', 'alert');
    banner.style.padding = '8px 12px';
    banner.style.borderRadius = '4px';
    banner.style.fontSize = '14px';
    banner.style.display = 'flex';
    banner.style.justifyContent = 'space-between';
    banner.style.alignItems = 'center';
    banner.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
    
    // Set colors based on type
    switch (settings.type) {
      case 'error':
        banner.style.backgroundColor = '#f8d7da';
        banner.style.color = '#721c24';
        banner.style.borderLeft = '4px solid #dc3545';
        break;
      case 'warning':
        banner.style.backgroundColor = '#fff3cd';
        banner.style.color = '#856404';
        banner.style.borderLeft = '4px solid #ffc107';
        break;
      case 'info':
      default:
        banner.style.backgroundColor = '#d1ecf1';
        banner.style.color = '#0c5460';
        banner.style.borderLeft = '4px solid #17a2b8';
        break;
    }
    
    // Create message container
    const messageSpan = document.createElement('span');
    messageSpan.textContent = message;
    messageSpan.style.flex = '1';
    
    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;'; // × character
    closeButton.style.background = 'none';
    closeButton.style.border = 'none';
    closeButton.style.color = 'inherit';
    closeButton.style.fontSize = '20px';
    closeButton.style.cursor = 'pointer';
    closeButton.style.padding = '0 4px';
    closeButton.style.marginLeft = '8px';
    closeButton.setAttribute('aria-label', 'Close');
    
    // Close functionality
    const closeBanner = () => {
      if (banner && banner.parentNode) {
        banner.parentNode.removeChild(banner);
        
        // Remove the container if no banners left
        if (bannerContainer.children.length === 0) {
          bannerContainer.parentNode.removeChild(bannerContainer);
        }
      }
    };
    
    closeButton.addEventListener('click', closeBanner);
    
    // Add elements to banner
    banner.appendChild(messageSpan);
    banner.appendChild(closeButton);
    
    // Add the banner to the container
    bannerContainer.appendChild(banner);
    
    // Auto-dismiss
    if (settings.timeout > 0) {
      setTimeout(closeBanner, settings.timeout);
    }
    
    console.log('showBanner: Banner displayed successfully', { type: settings.type, message });
    return banner;
  } catch (error) {
    console.error('showBanner: Error displaying banner', error);
    return null;
  }
}

const AI_REPLY_BUTTON_ID = 'ai-reply-button';
const MODAL_HOST_ID = 'ai-modal-host';
const GMAIL_COMPOSE_TOOLBAR_SELECTOR = '.aSs, .aDj, [role="toolbar"], .bAK, .btC';

let modalHost = null; // Keep track of the modal host element
let shadowRoot = null; // Keep track of the shadow root
let currentComposeWindow = null; // Store reference to the compose window that opened the modal

// Define CSS classes for visibility control
// const VISIBLE_CLASS = 'visible';
// const HIDDEN_CLASS = 'hidden';

/**
 * Fetches text content from a URL.
 * @param {string} url - The URL to fetch.
 * @returns {Promise<string>} - The text content.
 */
async function fetchText(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Error fetching resource:', error);
    return ''; // Return empty string on error
  }
}

/**
 * Simple HTML decoding (handles basic entities like &amp;, &lt;, &gt;, &quot;, &#39;).
 * More robust decoding might require a library or more entities.
 * @param {string} text The text to decode.
 * @returns {string} The decoded text.
 */
function htmlDecode(text) {
    const tempElement = document.createElement('textarea');
    tempElement.innerHTML = text;
    return tempElement.value;
}

/**
 * Closes the modal and removes it from the DOM.
 */
function closeModal() {
  try {
    // Remove keydown listener first while shadowRoot is still defined
    if (shadowRoot) {
      shadowRoot.removeEventListener('keydown', handleKeyDown);
    }

    if (modalHost) {
      console.log('Closing modal...');
      // Ensure modalHost is still in the DOM before removing
      if (document.body.contains(modalHost)) {
        // Try multiple removal methods for robustness
        if (modalHost.parentNode) {
          modalHost.parentNode.removeChild(modalHost);
        } else {
          modalHost.remove();
        }
      }
      
      // Always clear references
      modalHost = null;
      shadowRoot = null;
      currentComposeWindow = null; // Also clear the compose window reference
      console.log('Modal closed successfully');
    }
  } catch (error) {
    console.error('Error in closeModal:', error);
    // Last resort fallback - try direct removal
    document.getElementById(MODAL_HOST_ID)?.remove();
    modalHost = null;
    shadowRoot = null;
    currentComposeWindow = null;
  }
}

/**
 * Handles keydown events within the modal for ESC and focus trapping.
 * @param {KeyboardEvent} event
 */
function handleKeyDown(event) {
    if (!shadowRoot) return;

    if (event.key === 'Escape') {
        closeModal();
        return;
    }

    if (event.key === 'Tab') {
        const focusableElements = shadowRoot.querySelectorAll(
            'textarea, button, [href], input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        const currentElement = shadowRoot.activeElement;

        if (event.shiftKey) { // Shift + Tab
            if (currentElement === firstElement) {
                lastElement.focus();
                event.preventDefault();
            }
        } else { // Tab
            if (currentElement === lastElement) {
                firstElement.focus();
                event.preventDefault();
            }
        }
        // Allow default tab behavior otherwise
    }
}

/**
 * Shows or hides the spinner within the modal using data-attribute.
 * @param {boolean} show - True to show, false to hide.
 */
function toggleSpinner(show) {
    if (!shadowRoot) return;
    const spinner = shadowRoot.querySelector('.ai-reply-spinner');
    if (spinner) {
        // Use both data attribute and direct style for maximum compatibility
        if (show) {
            spinner.setAttribute('data-visible', 'true');
            spinner.style.display = 'block';
            console.log('Spinner shown');
        } else {
            spinner.removeAttribute('data-visible');
            spinner.style.display = 'none';
            console.log('Spinner hidden');
        }
    } else {
        console.warn('Spinner element not found in shadow DOM');
    }
    
    // Disable/enable buttons while spinner is active
    const submitButton = shadowRoot.querySelector('.ai-reply-submit');
    const cancelButton = shadowRoot.querySelector('.ai-reply-cancel');
    if (submitButton) submitButton.disabled = show;
    if (cancelButton) cancelButton.disabled = show;
}

/**
 * Handles the form submission: sends data to background, shows spinner.
 */
async function handleSubmit() {
    console.log('handleSubmit triggered');
    if (!shadowRoot || !currentComposeWindow) {
        console.error('Cannot submit - shadowRoot or currentComposeWindow is null');
        return;
    }

    // Always show spinner at start of submission
    toggleSpinner(true);
    
    let settings;
    try {
        // Get settings before proceeding
        console.log('Fetching settings...');
        const settingsResponse = await chrome.runtime.sendMessage({ type: 'getSettings' });
        if (!settingsResponse || !settingsResponse.success || !settingsResponse.settings) {
            throw new Error(settingsResponse?.error || 'Could not retrieve settings.');
        }
        settings = settingsResponse.settings;
        console.log('Settings retrieved for submission:', settings);
    } catch (error) {
        console.error('Error getting settings during submit:', error);
        displayErrorInModal(`Error getting settings: ${error.message}`);
        showBanner(currentComposeWindow, `AI Reply Error: Failed to get settings - ${error.message}`, { 
            type: 'error',
            timeout: 8000 
        });
        toggleSpinner(false);
        return;
    }

    const textarea = shadowRoot.querySelector('#ai-talking-points');
    const bulletPoints = textarea?.value.trim() || '';
    const emailContext = "Placeholder email context";

    console.log('Submitting request with talking points:', bulletPoints);

    try {
        // Call API to generate draft
        console.log('Sending message to background script...');
        const response = await chrome.runtime.sendMessage({
            type: "generate",
            bulletPoints,
            emailContext
        });
        console.log('Received response from background:', response);

        // Handle explicit failure
        if (!response || response.success === false) {
            const errorMessage = response?.error || 'API returned an error or no response.';
            console.error('API error:', errorMessage);
            displayErrorInModal(`Error: ${errorMessage}`);
            showBanner(currentComposeWindow, `AI Reply Error: ${errorMessage}`, {
                type: 'error',
                timeout: 8000
            });
            toggleSpinner(false);
            return;
        }
        
        // Check if we have a valid draft to insert
        if (response.draft) {
            console.log('Draft generated, attempting to append to compose window...');
            // Store a reference to the compose window before we potentially lose it
            const composeWindowToUpdate = currentComposeWindow;
            const success = appendDraft(composeWindowToUpdate, response.draft);
            
            if (success) {
                console.log('Draft successfully inserted into compose window');
                
                // Hide spinner before closing
                toggleSpinner(false);
                
                // Close the modal FIRST - this was causing one of the issues
                const closeSuccess = closeModal();
                console.log('Modal close result:', closeSuccess);
                
                // Show success notification
                showBanner(composeWindowToUpdate, 'AI Reply draft successfully added!', {
                    type: 'info',
                    timeout: 3000
                });
                
                return true;
            } else {
                // Draft wasn't inserted
                console.error('Failed to insert draft into compose window');
                displayErrorInModal('Error: Failed to insert draft into compose window.');
                showBanner(currentComposeWindow, 'AI Reply Error: Failed to insert draft into compose window', {
                    type: 'error',
                    timeout: 8000
                });
                toggleSpinner(false);
                return false;
            }
        } else {
            // Invalid response
            console.error('Invalid response from background:', response);
            const errorMessage = 'No draft was generated.';
            displayErrorInModal(`Error: ${errorMessage}`);
            showBanner(currentComposeWindow, `AI Reply Error: ${errorMessage}`, {
                type: 'error',
                timeout: 8000
            });
            toggleSpinner(false);
            return false;
        }
    } catch (error) {
        // Network or other errors
        console.error('Error in handleSubmit:', error);
        displayErrorInModal(`Error: ${error.message}`);
        showBanner(currentComposeWindow, `AI Reply Error: ${error.message}`, {
            type: 'error',
            timeout: 8000
        });
        toggleSpinner(false);
        return false;
    }
}

/**
 * Displays an error message in the modal.
 * @param {string} message - The error message to display.
 */
function displayErrorInModal(message) {
    if (!shadowRoot) return;
    console.error('Error to display in modal:', message);
    
    const errorDiv = shadowRoot.querySelector('.ai-reply-error');
    if (errorDiv) {
        // Set both the style and data attribute for visibility
        errorDiv.style.display = 'block';
        errorDiv.setAttribute('data-visible', 'true');
        errorDiv.textContent = message;
        
        // Also ensure the spinner is hidden
        toggleSpinner(false);
        
        // Focus the error div for screen readers
        errorDiv.focus();
        
        // Let error be visible for a moment
        setTimeout(() => {
            if (errorDiv) {
                errorDiv.setAttribute('aria-live', 'assertive');
            }
        }, 100);
    } else {
        // Fallback if error div not found
        console.warn('Error div not found in shadow DOM, showing alert instead');
        alert(message);
    }
}

/**
 * Creates and opens the modal in a Shadow DOM.
 * @returns {Promise<boolean>} - True if modal opened successfully, false otherwise.
 */
async function openModal(triggeringComposeWindow) {
  // Prevent multiple modals
  if (document.getElementById(MODAL_HOST_ID)) {
    console.log('Modal already open.');
    return false;
  }

  console.log('Attempting to open AI Reply Modal...');

  // 1. Get settings first
  let settings;
  try {
    const settingsResponse = await chrome.runtime.sendMessage({ type: 'getSettings' });
    if (!settingsResponse || !settingsResponse.success || !settingsResponse.settings) {
      throw new Error(settingsResponse?.error || 'Could not retrieve settings.');
    }
    settings = settingsResponse.settings;
    console.log('Settings retrieved successfully for modal open:', settings);
    // TODO: Potentially validate settings here (e.g., check for API key)
    // if (!settings.apiKey) { throw new Error('API Key is missing in settings.'); }
  } catch (error) {
    console.error('Error getting settings before opening modal:', error);
    // Show error banner instead of alert
    if (triggeringComposeWindow) {
      showBanner(triggeringComposeWindow, `AI Reply Error: ${error.message}`, {
        type: 'error',
        timeout: 8000
      });
    } else {
      // Fallback to alert only if no compose window is available
      window.alert(`Error getting settings: ${error.message}`);
    }
    return false; // Do not open modal if settings fail
  }

  // If settings are okay, proceed to create and open the modal
  console.log('Settings OK, opening modal...');

  // Get selected text *before* creating modal DOM
  let selectedText = '';
  try {
    selectedText = window.getSelection().toString();
    if (selectedText) {
        console.log('Found selected text:', selectedText);
        selectedText = htmlDecode(selectedText.trim());
        console.log('Decoded selected text:', selectedText);
    }
  } catch (error) {
      console.error('Error getting window selection:', error);
      // Proceed without selected text
  }

  try {
    // Create host element
    modalHost = document.createElement('div');
    modalHost.id = MODAL_HOST_ID;
    document.body.appendChild(modalHost);

    // Attach shadow root
    shadowRoot = modalHost.attachShadow({ mode: 'open' });

    // Fetch modal HTML and CSS
    const [modalHTML, modalCSS] = await Promise.all([
      fetchText(chrome.runtime.getURL('ui/modal.html')),
      fetchText(chrome.runtime.getURL('ui/modal.css')),
    ]);

    if (!modalHTML || !modalCSS) {
      throw new Error('Failed to load modal resources.');
    }

    // Inject CSS
    const styleElement = document.createElement('style');
    styleElement.textContent = modalCSS;
    shadowRoot.appendChild(styleElement);

    // Inject HTML
    const template = document.createElement('template');
    template.innerHTML = modalHTML; // Assumes modal.html contains the structure directly
    shadowRoot.appendChild(template.content.cloneNode(true));

    const overlay = shadowRoot.querySelector('.ai-reply-overlay');
    const modalContentElement = shadowRoot.querySelector('.ai-reply-modal');
    const cancelButton = shadowRoot.querySelector('.ai-reply-cancel');
    const submitButton = shadowRoot.querySelector('.ai-reply-submit');
    const textarea = shadowRoot.querySelector('#ai-talking-points');

    // Add event listeners
    if (cancelButton) cancelButton.addEventListener('click', closeModal);
    else console.warn('Cancel button not found...');

    // Attach handleSubmit to submit button
    if (submitButton && textarea) {
      submitButton.addEventListener('click', handleSubmit);
    } else {
      if (!submitButton) console.warn('Submit button not found...');
      if (!textarea) console.warn('Textarea not found...');
    }
    
    // --- ADDED: Keydown listener for Cmd/Ctrl+Enter on textarea ---
    if (textarea && submitButton) {
        textarea.addEventListener('keydown', (event) => {
            // Check for Cmd+Enter (Mac) or Ctrl+Enter (Windows/Linux)
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault(); // Prevent adding a newline
                console.log('Cmd/Ctrl+Enter detected, triggering Generate...');
                // Trigger click on the submit button if it's not disabled
                if (!submitButton.disabled) {
                    submitButton.click();
                }
            }
        });
    } else {
        if (!textarea) console.warn('Textarea not found for keydown listener.');
        if (!submitButton) console.warn('Submit button not found for keydown listener trigger.');
    }
    // --- END ADDED --- 

    // Listener for click outside modal content
    if (overlay && modalContentElement) {
        overlay.addEventListener('click', (event) => {
            // Close only if the click is directly on the overlay, not its children (the modal)
            if (event.target === overlay) {
                closeModal();
            }
        });
    } else {
        console.warn('Overlay or modal content element not found for click-outside listener.');
    }

    // Listener for ESC key and focus trap
    shadowRoot.addEventListener('keydown', handleKeyDown);

    // Prefill and Focus the textarea
    if (textarea) {
      if (selectedText) {
        textarea.value = selectedText;
        console.log('Prefilled textarea with selected text.');
      }
      textarea.focus();
    } else {
      console.warn('Textarea not found in modal template for focus/prefill.');
    }

    currentComposeWindow = triggeringComposeWindow; // Store the reference
    console.log('AI Reply Modal opened successfully.');
    return true;
  } catch (error) {
    console.error('Error opening modal:', error);
    // Show error banner if possible
    if (triggeringComposeWindow) {
      showBanner(triggeringComposeWindow, `AI Reply Error: Failed to open modal - ${error.message}`, {
        type: 'error',
        timeout: 8000
      });
    }
    closeModal(); // Clean up on error
    return false;
  }
}

/**
 * Creates the AI Reply button element with styles and event listener.
 * Does NOT inject the button into the DOM.
 * @param {HTMLElement} composeWindow - The associated compose window for the click listener.
 * @returns {HTMLElement} - The created button element.
 */
function createAIReplyButton(composeWindow) {
  // Create the button element
  const button = document.createElement('button');
  button.id = AI_REPLY_BUTTON_ID; // Use the constant ID
  button.textContent = 'AI Reply';
  button.className = 'ai-reply-button'; // Use a consistent class name
  
  // Style the button to match Gmail's design
  button.style.backgroundColor = '#0b57d0';
  button.style.color = 'white';
  button.style.border = 'none';
  button.style.borderRadius = '4px';
  button.style.padding = '8px 16px';
  button.style.fontSize = '14px';
  button.style.fontWeight = '500';
  button.style.cursor = 'pointer';
  button.style.transition = 'background-color 0.2s';
  button.style.marginLeft = '4px'; // Add some spacing
  button.style.verticalAlign = 'middle'; // Align with other buttons
  
  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = '#0842a0';
  });
  
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = '#0b57d0';
  });
  
  // Add click event listener
  button.addEventListener('click', () => {
    console.log('AI Reply button clicked for compose window:', composeWindow);
    openModal(composeWindow);
  });
  
  return button;
}

/**
 * Injects the AI Reply button into the Gmail compose toolbar
 * @param {HTMLElement} composeWindow - The compose window element
 * @returns {HTMLElement|null} - The injected button element, or null if injection failed
 */
function injectButton(composeWindow) {
  if (!composeWindow) return null;
  
  // removeDuplicateButtons(composeWindow); // Let's rely on the root marker for now
  
  // Check if button already exists using the marker on the root
  // const existingButtonInWindow = findExistingButtonNear(composeWindow); // Replaced by root check
  // if (existingButtonInWindow) return existingButtonInWindow;

  console.log('[injectButton] Attempting to inject button for compose window:', composeWindow);
  
  // --- FIND INJECTION POINT & ROOT --- 
  const injectionResult = findPreferredInjectionPoint(composeWindow);
  
  if (!injectionResult) {
    console.log('[injectButton] No injection point found.');
    return null; // Don't inject if the preferred location isn't found
  }

  const { injectionPoint, composeRoot } = injectionResult;

  // --- CHECK MARKER --- 
  if (composeRoot.dataset.aiReplyInjected === 'true') {
      console.log('[injectButton] Button already injected in this compose root (marker found). Skipping.', composeRoot);
      return composeRoot.querySelector(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`); // Return existing button if found
  }

  // --- CREATE & INJECT BUTTON --- 
  const button = createAIReplyButton(composeWindow);
  
  console.log('[injectButton] Injecting button near:', injectionPoint, 'within root:', composeRoot);
  
  // Inject next to the found injection point
  if (injectionPoint.nextSibling) {
    injectionPoint.parentNode.insertBefore(button, injectionPoint.nextSibling);
  } else {
    injectionPoint.parentNode.appendChild(button);
  }
  
  // --- ADD MARKER --- 
  composeRoot.dataset.aiReplyInjected = 'true';
  console.log('[injectButton] Marked compose root as injected:', composeRoot);
  
  return button;
}

/**
 * Finds the preferred injection point, which is the Send button or its immediate container.
 * @param {HTMLElement} composeWindow - The compose window element
 * @returns {HTMLElement|null} - The Send button element or its container, or null if not found.
 */
function findPreferredInjectionPoint(composeWindow) {
  console.log('[findPreferredInjectionPoint] Starting search relative to compose window:', composeWindow);

  // 1. Find the overarching compose view element (dialog, form, etc.)
  //    Selectors for different compose modes (popup, inline reply, main window)
  const composeRoot = composeWindow.closest('.AD, .aoP, .dw, form[target], .gmail_default, .ip.adB'); 
  
  if (!composeRoot) {
    console.error('[findPreferredInjectionPoint] Could not find overarching compose root element.');
    // Fallback: Use the composeWindow's parent? Might be too fragile.
    // return null; // Or try a less reliable fallback if needed
    
    // Let's try the previous container logic as a fallback before giving up
    const fallbackContainer = composeWindow.closest('form, [role="dialog"], .M9, .aO9, table');
    if (!fallbackContainer) {
        console.error('[findPreferredInjectionPoint] Could not find any suitable container (primary or fallback).');
        return null;
    }
    console.warn('[findPreferredInjectionPoint] Using fallback container logic. Searching for buttons within:', fallbackContainer);
    composeRoot = fallbackContainer; // Use the fallback container as the root for search
  } else {
    console.log('[findPreferredInjectionPoint] Found potential compose root element:', composeRoot);
  }

  // 2. Search within the *entire* compose root for the Send button area
  console.log('[findPreferredInjectionPoint] Searching for buttons within the compose root...');
  const buttons = composeRoot.querySelectorAll('div[role="button"], button');
  let sendButton = null;

  console.log(`[findPreferredInjectionPoint] Found ${buttons.length} potential buttons in compose root:`, composeRoot);
  for (const button of buttons) {
    // Check multiple indicators for the Send button:
    // 1. Text content (trimmed)
    // 2. data-tooltip attribute (containing "Send")
    // 3. aria-label attribute (containing "Send")
    const buttonText = button.textContent?.trim();
    const tooltip = button.getAttribute('data-tooltip');
    const ariaLabel = button.getAttribute('aria-label');
    
    // Log button details for debugging
    console.log('Checking button:', {
      element: button,
      textContent: buttonText,
      tooltip: tooltip,
      ariaLabel: ariaLabel
    });

    if (
      (buttonText === 'Send') || // Keep exact match check
      (tooltip && tooltip.toLowerCase().includes('send')) || // Case-insensitive tooltip check
      (ariaLabel && ariaLabel.toLowerCase().includes('send')) // Case-insensitive aria-label check
    ) {
      sendButton = button;
      console.log('>>> Send button FOUND based on attributes');
      // Return both the injection point and the root element searched
      return { injectionPoint: sendButton, composeRoot: composeRoot }; 
      // break; // No longer needed after return
    }
  }

  // If send button not found via attribute check, try the fallback
  console.log('[findPreferredInjectionPoint] Send button not found via attributes/text. Checking fallback row...');
  const bottomRow = composeRoot.querySelector('.aZK, .bAK, .gU.Up');
  if (bottomRow) {
    console.log('Found bottom action row:', bottomRow);
    // Find the last button/control in that row to inject after
    const lastButton = bottomRow.querySelector('div[role="button"]:last-child, button:last-child');
    if (lastButton) {
        return { injectionPoint: lastButton, composeRoot: composeRoot };
    } 
    // Inject into the row itself if no specific button found
    return { injectionPoint: bottomRow, composeRoot: composeRoot }; 
  }

  console.log('[findPreferredInjectionPoint] Send button area / fallback row not found within the identified root.');
  return null;
}

/**
 * Removes duplicate AI Reply buttons near a compose window
 * @param {HTMLElement} composeWindow - The compose window element
 */
function removeDuplicateButtons(composeWindow) {
  // Get all AI Reply buttons
  const allButtons = document.querySelectorAll(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`);
  
  if (allButtons.length <= 1) return; // No duplicates
  
  // If there are duplicates, keep track of which ones to remove
  const buttonsToRemove = [];
  
  // Find the closest container to the compose window
  const container = composeWindow.closest('form, [role="dialog"], .M9, .aO9, table');
  
  if (container) {
    // Get buttons within this container
    const buttonsInContainer = Array.from(container.querySelectorAll(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`));
    
    // If there are multiple buttons in container, keep only the first one
    if (buttonsInContainer.length > 1) {
      for (let i = 1; i < buttonsInContainer.length; i++) {
        buttonsToRemove.push(buttonsInContainer[i]);
      }
    }
  }
  
  // Remove marked buttons
  buttonsToRemove.forEach(button => {
    console.log('Removing duplicate button:', button);
    button.remove();
  });
}

/**
 * Finds an existing AI Reply button near the compose window
 * @param {HTMLElement} composeWindow - The compose window element
 * @returns {HTMLElement|null} - The existing button or null
 */
function findExistingButtonNear(composeWindow) {
  // Check if button already exists in this compose window
  const existingButton = composeWindow.querySelector(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`);
  if (existingButton) return existingButton;
  
  // Check in parent containers
  const container = composeWindow.closest('form, [role="dialog"], .M9, .aO9, table');
  if (container) {
    const buttonInContainer = container.querySelector(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`);
    if (buttonInContainer) return buttonInContainer;
  }
  
  return null;
}

/**
 * Scans the document for existing compose windows and injects the button.
 */
function injectIntoExistingWindows() {
  // First, clean up any buttons that might exist from previous runs/errors
  cleanupAllButtons(); 
  
  console.log('Scanning for existing compose windows...');
  const composeWindows = getComposeWindows();
  
  composeWindows.forEach(composeWindow => {
    // For each compose window, try to inject ONE button in the preferred location
    const injectionPoint = findPreferredInjectionPoint(composeWindow);
    if (injectionPoint) {
      // Double-check if a button *already* exists exactly where we want to inject
      if (!injectionPoint.parentNode.querySelector(`#${AI_REPLY_BUTTON_ID}`)) {
        const button = createAIReplyButton(composeWindow);
        console.log('Injecting AI Reply button near Send button area for window:', composeWindow);
        // Inject next to the Send button or its container
        if (injectionPoint.nextSibling) {
          injectionPoint.parentNode.insertBefore(button, injectionPoint.nextSibling);
        } else {
          injectionPoint.parentNode.appendChild(button);
        }
      } else {
        console.log('Button already exists at preferred injection point.');
      }
    } else {
      console.log('No preferred injection point found for window:', composeWindow);
    }
  });
}

/**
 * Sets up the mutation observer to detect new compose windows
 */
function setupMutationObserver() {
  const specificSelector = 'div[contenteditable="true"][role="textbox"][aria-label="Message Body"]';
  console.log('[MutationObserver] Setting up observer to look for specific selector:', specificSelector);

  const observer = new MutationObserver((mutationsList) => {
    let injectedInThisMutation = false; // Avoid multiple injections from one mutation batch
    for (const mutation of mutationsList) {
      if (injectedInThisMutation) break; // Optimization
      if (mutation.type === 'childList') {
        for (const node of mutation.addedNodes) { 
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node itself is the target div
            if (node.matches && node.matches(specificSelector)) {
              console.log('[MutationObserver] Found matching node directly:', node);
              injectButton(node);
              injectedInThisMutation = true;
              break; // Found it, stop checking nodes in this mutation
            }
            // Otherwise, check if the target div exists within the added node
            const targetDiv = node.querySelector(specificSelector);
            if (targetDiv) {
              console.log('[MutationObserver] Found matching node via querySelector:', targetDiv);
              injectButton(targetDiv);
              injectedInThisMutation = true;
              break; // Found it, stop checking nodes in this mutation
            }
          }
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  console.log('Mutation observer started');
}

// Removes *all* AI Reply buttons from the page, except optionally one
function cleanupAllButtons(keepButton = null) {
  console.log('[cleanupAllButtons] Starting cleanup...');
  
  // Remove marker attribute from all potential roots first
  const markedRoots = document.querySelectorAll('[data-ai-reply-injected="true"]');
  console.log(`[cleanupAllButtons] Found ${markedRoots.length} elements marked as injected. Removing markers.`);
  markedRoots.forEach(root => {
      try {
          delete root.dataset.aiReplyInjected;
          console.log('[cleanupAllButtons] Removed marker from:', root);
      } catch (e) {
          console.warn('[cleanupAllButtons] Could not remove marker from element:', root, e);
      }
  });

  // Now remove the button elements themselves
  const allButtons = document.querySelectorAll(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`);
  console.log(`[cleanupAllButtons] Found ${allButtons.length} total AI Reply button elements for removal.`);
  
  allButtons.forEach(button => {
    if (button === keepButton) {
      console.log('Keeping intended button:', button);
      return; // Don't remove the button we intend to keep
    }
    console.log('Removing potentially duplicate button:', button);
    button.remove();
  });
}

// --- Main Execution ---

// Start the extension with a slight delay to ensure Gmail UI is loaded
console.log('AI Reply Assistant content script loaded...');

// First clean up any existing buttons (useful when reloading the extension)
cleanupAllButtons();

// Add event listener for Gmail's internal page changes
window.addEventListener('hashchange', function() {
  console.log('URL hash changed, running injection logic again...');
  // Add a small delay after hash change before injecting
  setTimeout(injectIntoExistingWindows, 500); 
});

// Add a short delay before initializing to ensure Gmail DOM is fully rendered
setTimeout(() => {
  console.log('Initializing AI Reply Assistant...');
  injectIntoExistingWindows(); // Initial injection
  setupMutationObserver(); // Start observing for dynamic changes
  
  // No need for secondary or periodic checks if MutationObserver and hashchange work well
  // Keep the interval code commented out for now, can re-enable if needed.
  /*
  // Set up less frequent periodic checking for changes in Gmail's UI
  setInterval(() => {
    console.log('Performing periodic check for compose windows...');
    injectIntoExistingWindows();
  }, 30000); // Check every 30 seconds 
  */
}, 500);

// --- Test Utilities --- 

// Expose internals for simplified testing where Shadow DOM causes issues.
// Use with caution and only in test environment.
// export function __setTestingInternals(internals) {
//   if (process.env.NODE_ENV === 'test') { // Ensure this only runs in test
//     shadowRoot = internals.shadowRoot;
//     currentComposeWindow = internals.currentComposeWindow;
//   } else {
//     console.error('__setTestingInternals should only be called in test environment.');
//   }
// }

// export function __getHandleSubmitForTesting() {
//     if (process.env.NODE_ENV === 'test') {
//         return handleSubmit;
//     } else {
//         console.error('__getHandleSubmitForTesting should only be called in test environment.');
//         return null; // Or throw an error
//     }
// } 
// } 