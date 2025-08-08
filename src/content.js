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
    const fallbackSelector = '[contenteditable="true"][role="textbox"]';
    potentialWindows = Array.from(document.querySelectorAll(fallbackSelector));
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
 * @param {Element} options.customClass - An optional additional CSS class to add to the banner element.
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
      bannerContainer.style.bottom = '40px';
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
    if (settings.customClass) {
      banner.classList.add(settings.customClass);
    }
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
        showBanner(currentComposeWindow, `Error getting settings: ${error.message}`, { 
            type: 'error',
            timeout: 8000 
        });
        toggleSpinner(false);
        return;
    }

    const textarea = shadowRoot.querySelector('#ai-talking-points');
    const bulletPoints = textarea?.value.trim() || '';
    // Retrieve context from the dataset of the compose window that opened the modal
    const emailContext = currentComposeWindow?.dataset?.emailContext || 'Context not found';
    console.log('Using email context from compose window dataset:', emailContext);

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
                    timeout: 1000
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
 * Attempts to extract context (Subject, Sender, Body) from the email being replied to.
 * This is complex due to Gmail's changing DOM.
 * @param {HTMLElement} composeWindow - The element representing the compose area (e.g., the editable div).
 * @returns {string} - A formatted string containing the extracted context, or a default message.
 */
function extractEmailContext(composeWindow) {
  console.log('[extractEmailContext] Attempting to extract context relative to:', composeWindow);
  let context = 'Email context could not be determined.'; // Default message
  const MAX_CONTEXT_LENGTH = 3000; // Limit context size

  try {
    // Find the main container for the entire email view/thread this compose window belongs to.
    const emailContainer = composeWindow.closest('.nH.Hd, .aia, .Bk, .Bs, .nH.if'); // Common containers for email threads/views

    if (!emailContainer) {
      console.warn('[extractEmailContext] Could not find top-level email container.');
      return context; // Return default message
    }
    console.log('[extractEmailContext] Found potential email container:', emailContainer);

    // --- Extract ALL text content from the container --- 
    context = emailContainer.textContent?.trim() || 'Container found but empty';

    // Limit context length
    if (context.length > MAX_CONTEXT_LENGTH) {
      context = context.substring(0, MAX_CONTEXT_LENGTH) + '... [Full Context Truncated]';
    }
    console.log('[extractEmailContext] Extracted full container context (truncated):', context);

    // --- REMOVED specific subject/sender/body extraction logic ---
    // let subject = ...
    // let sender = ...
    // let body = ...
    // ... etc ...

  } catch (error) {
    console.error('[extractEmailContext] Error during extraction:', error);
    context = 'Error extracting email context.';
  }

  // Return the extracted (and potentially truncated) context
  return context;
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
  // button.textContent = 'AI Reply'; // Remove text
  button.className = 'ai-reply-button ai-reply-icon-button'; // Add specific class for icon styling
  button.setAttribute('aria-label', 'AI Reply'); // Accessibility
  button.setAttribute('title', 'AI Reply'); // Tooltip on hover
  
  // Set the SVG icon as innerHTML
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M16.5 12c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5z" opacity=".3"/><circle cx="15.01" cy="18" opacity=".3" r="1"/><circle cx="7" cy="14" opacity=".3" r="2"/><path d="M7 18c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm11.01 6c0-1.65-1.35-3-3-3s-3 1.35-3 3 1.35 3 3 3 3-1.35 3-3zm-4 0c0-.55.45-1 1-1s1 .45 1 1-.45 1-1 1-1-.45-1-1zm2.49-4c3.03 0 5.5-2.47 5.5-5.5S19.53 3 16.5 3 11 5.47 11 8.5s2.47 5.5 5.5 5.5zm0-9C18.43 5 20 6.57 20 8.5S18.43 12 16.5 12 13 10.43 13 8.5 14.57 5 16.5 5z"/></svg>`;
  
  // Style the button as an icon button (mimic Gmail's style)
  button.style.backgroundColor = 'transparent'; // No background
  button.style.border = 'none';
  button.style.borderRadius = '50%'; // Circular
  button.style.padding = '6px'; // Adjust padding for icon size
  button.style.marginLeft = '4px'; // Keep spacing
  button.style.marginRight = '4px'; // Add spacing after
  button.style.verticalAlign = 'middle';
  button.style.cursor = 'pointer';
  button.style.display = 'inline-flex'; // Center icon
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.width = '32px'; // Fixed width
  button.style.height = '32px'; // Fixed height
  button.style.color = '#5f6368'; // Default icon color (match Gmail?)
  
  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(60, 64, 67, 0.08)'; // Gmail's hover effect
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
  });
  
  // Add click event listener
  button.addEventListener('click', () => {
    console.log('AI Reply button clicked for compose window:', composeWindow);
    
    // Extract context before opening modal
    const emailContext = extractEmailContext(composeWindow);
    console.log('Extracted email context:', emailContext);
    // Store context in the compose window element's dataset
    try {
        composeWindow.dataset.emailContext = emailContext;
    } catch (e) {
        console.error('Failed to set email context on dataset:', e);
    }
    
    openModal(composeWindow);
  });
  
  return button;
}

/**
 * Creates the AI Improve Text button element with styles and event listener.
 * @param {HTMLElement} composeWindow - The associated compose window for the click listener.
 * @returns {HTMLElement} - The created button element.
 */
function createImproveTextButton(composeWindow) {
  const button = document.createElement('button');
  button.id = 'ai-improve-text-button'; // New distinct ID
  button.className = 'ai-improve-button ai-reply-icon-button'; // New specific class + common styling class
  button.setAttribute('aria-label', 'Improve Selected Text');
  button.setAttribute('title', 'Improve Selected Text (Cmd+Shift+G)');

  // Set a different icon (e.g., Material Icons "edit" or "auto_fix_high")
  button.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" height="20" viewBox="0 0 24 24" width="20" fill="currentColor"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`; // Pencil Icon

  // Apply similar styling as the reply button
  button.style.backgroundColor = 'transparent';
  button.style.border = 'none';
  button.style.borderRadius = '50%';
  button.style.padding = '6px';
  button.style.marginLeft = '4px'; 
  button.style.marginRight = '4px';
  button.style.verticalAlign = 'middle';
  button.style.cursor = 'pointer';
  button.style.display = 'inline-flex';
  button.style.alignItems = 'center';
  button.style.justifyContent = 'center';
  button.style.width = '32px';
  button.style.height = '32px';
  button.style.color = '#5f6368';

  // Add hover effect
  button.addEventListener('mouseenter', () => {
    button.style.backgroundColor = 'rgba(60, 64, 67, 0.08)';
  });
  button.addEventListener('mouseleave', () => {
    button.style.backgroundColor = 'transparent';
  });

  // Add event listener - Use mousedown to capture selection before focus shifts
  button.addEventListener('mousedown', (event) => {
    // Prevent the mousedown from potentially blurring the editor and losing selection
    event.preventDefault(); 
    
    console.log('AI Improve Text button mousedown for compose window:', composeWindow);

    const selectedText = window.getSelection().toString().trim();

    if (!selectedText) {
      console.log('Improve button mousedown, but no text selected.');
      showBanner(composeWindow, 'Please select the text you want to improve.', { type: 'info', timeout: 3000 });
      return; // Stop if nothing is selected
    }

    console.log('Selected text detected for improvement:', selectedText);
    // Show visual feedback
    showBanner(composeWindow, 'Improving text...', { type: 'info', timeout: 0, customClass: 'ai-reply-banner-improving' });

    const context = extractEmailContext(composeWindow);
    console.log('Extracted context for improve:', context);

    try {
      chrome.runtime.sendMessage(
        { type: 'IMPROVE_TEXT', selectedText: selectedText, context: context },
        handleImproveTextResult // Pass the existing handler
      );
      console.log('IMPROVE_TEXT message sent to background script via button mousedown.');
    } catch (error) {
      console.error('Error sending IMPROVE_TEXT message from button:', error);
      // Remove visual feedback and show error
      const improvingBanner = composeWindow.querySelector('.ai-reply-banner-improving');
      if (improvingBanner) improvingBanner.remove();
      showBanner(composeWindow, `Error initiating improvement: ${error.message}`, { type: 'error' });
    }
  });

  return button;
}

/**
 * Injects the AI action buttons (Reply & Improve) into the Gmail compose toolbar.
 * @param {HTMLElement} composeWindow - The compose window element.
 * @returns {boolean} - True if buttons were injected or already present, false otherwise.
 */
function injectButtons(composeWindow) {
  if (!composeWindow) return false;

  console.log('[injectButtons] Attempting to inject buttons for compose window:', composeWindow);

  const injectionResult = findPreferredInjectionPoint(composeWindow);

  if (!injectionResult) {
    console.log('[injectButtons] No injection point found.');
    return false;
  }

  const { injectionParent, composeRoot } = injectionResult;

  // Use a single marker for both buttons
  if (composeRoot.dataset.aiButtonsInjected === 'true') {
    console.log('[injectButtons] Buttons already injected in this compose root (marker found). Skipping.', composeRoot);
    return true; // Indicate buttons are already there
  }

  // --- CREATE & INJECT BUTTONS --- 
  const replyButton = createAIReplyButton(composeWindow);
  const improveButton = createImproveTextButton(composeWindow);

  console.log('[injectButtons] Injecting buttons into parent:', injectionParent, 'within root:', composeRoot);

  // Append both buttons to the identified parent container
  // Inject Improve button first, then Reply button (order might matter visually)
  injectionParent.appendChild(improveButton);
  injectionParent.appendChild(replyButton); 

  // Add marker to the root
  composeRoot.dataset.aiButtonsInjected = 'true';
  console.log('[injectButtons] Marked compose root as injected:', composeRoot);

  return true;
}

/**
 * Finds the preferred injection point, which is the parent container of the Send button.
 * @param {HTMLElement} composeWindow - The compose window element
 * @returns {{injectionParent: HTMLElement, composeRoot: HTMLElement}|null} - The parent element for injection and the compose root, or null if not found.
 */
function findPreferredInjectionPoint(composeWindow) {
  console.log('[findPreferredInjectionPoint] Starting search relative to compose window:', composeWindow);

  // 1. Find the overarching compose view element
  const composeRoot = composeWindow.closest('.AD, .aoP, .dw, form[target], .gmail_default, .ip.adB');

  if (!composeRoot) {
    console.error('[findPreferredInjectionPoint] Could not find overarching compose root element.');
    const fallbackContainer = composeWindow.closest('form, [role="dialog"], .M9, .aO9, table');
    if (!fallbackContainer) {
      console.error('[findPreferredInjectionPoint] Could not find any suitable container (primary or fallback).');
      return null;
    }
    console.warn('[findPreferredInjectionPoint] Using fallback container logic. Searching for buttons within:', fallbackContainer);
    composeRoot = fallbackContainer; // Use the fallback container as the root
  } else {
    console.log('[findPreferredInjectionPoint] Found potential compose root element:', composeRoot);
  }

  // 2. Search within the compose root for the Send button
  console.log('[findPreferredInjectionPoint] Searching for Send button within the compose root...');
  const buttons = composeRoot.querySelectorAll('div[role="button"], button');
  let sendButton = null;

  for (const button of buttons) {
    const buttonText = button.textContent?.trim();
    const tooltip = button.getAttribute('data-tooltip');
    const ariaLabel = button.getAttribute('aria-label');

    if (
      (buttonText === 'Send') ||
      (tooltip && tooltip.toLowerCase().includes('send')) ||
      (ariaLabel && ariaLabel.toLowerCase().includes('send'))
    ) {
      sendButton = button;
      console.log('>>> Send button FOUND based on attributes:', sendButton);
      // Return the PARENT of the send button as the injection point
      if (sendButton.parentNode) {
          console.log('>>> Using Send button\'s parentNode as injection point:', sendButton.parentNode);
          return { injectionParent: sendButton.parentNode, composeRoot: composeRoot };
      }
    }
  }

  // Fallback: If send button not found, look for common toolbar/action rows
  console.log('[findPreferredInjectionPoint] Send button not found. Checking fallback rows...');
  // Selectors for potential toolbars or action rows at the bottom
  const commonToolbarSelectors = [
      '.btC',          // Common toolbar class
      '.gU.Up',        // Another toolbar class
      '.aDg',          // Toolbar containing formatting buttons
      '.aDh',          // Toolbar related to attachments/insertions
      '.aSs',          // Older toolbar class?
      '.aDj',          // Older toolbar class?
      '[role="toolbar"]',// Generic toolbar role
      '.bAK'           // Container often holding send button
  ];
  const bottomRow = composeRoot.querySelector(commonToolbarSelectors.join(', '));

  if (bottomRow) {
      console.log('>>> Using Fallback: Found toolbar/bottom row:', bottomRow);
      // Inject directly into this row
      return { injectionParent: bottomRow, composeRoot: composeRoot };
  }

  console.log('[findPreferredInjectionPoint] Send button parent / fallback row not found.');
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
  let injectedCount = 0;
  
  composeWindows.forEach(composeWindow => {
    // For each compose window, try to inject the buttons
    if (injectButtons(composeWindow)) { // Use the renamed function
        injectedCount++;
    }
  });
  console.log(`Injection scan complete. Injected buttons into ${injectedCount} windows.`);
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
              if (injectButtons(node)) { // Use the renamed function
                injectedInThisMutation = true;
              }
              break; // Found it, stop checking nodes in this mutation
            }
            // Otherwise, check if the target div exists within the added node
            const targetDiv = node.querySelector(specificSelector);
            if (targetDiv) {
              console.log('[MutationObserver] Found matching node via querySelector:', targetDiv);
              if (injectButtons(targetDiv)) { // Use the renamed function
                injectedInThisMutation = true;
              }
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
  const markedRoots = document.querySelectorAll('[data-ai-buttons-injected="true"]'); // Use the new marker
  console.log(`[cleanupAllButtons] Found ${markedRoots.length} elements marked as injected. Removing markers.`);
  markedRoots.forEach(root => {
      try {
          delete root.dataset.aiButtonsInjected; // Use the new marker
          console.log('[cleanupAllButtons] Removed marker from:', root);
      } catch (e) {
          console.warn('[cleanupAllButtons] Could not remove marker from element:', root, e);
      }
  });

  // Now remove the button elements themselves using their specific IDs or classes
  const replyButtons = document.querySelectorAll(`#${AI_REPLY_BUTTON_ID}, .ai-reply-button`);
  const improveButtons = document.querySelectorAll('#ai-improve-text-button, .ai-improve-button');
  console.log(`[cleanupAllButtons] Found ${replyButtons.length} AI Reply buttons and ${improveButtons.length} Improve Text buttons.`);
  
  replyButtons.forEach(button => {
    if (button !== keepButton) {
      // console.log('Removing AI Reply button:', button);
      button.remove();
    }
  });
  improveButtons.forEach(button => {
    if (button !== keepButton) {
      // console.log('Removing Improve Text button:', button);
      button.remove();
    }
  });
   console.log('[cleanupAllButtons] Cleanup finished.');
}

/**
 * Handles the response from the background script after requesting text improvement.
 * Replaces the currently selected text with the improved version.
 * @param {object} response - The response object from the background script.
 */
async function handleImproveTextResult(response) {
  console.log('[handleImproveTextResult] Started handling result:', response);
  const activeComposeWindow = findActiveComposeWindow();

  console.log('Handling IMPROVE_TEXT_RESULT:', response);
  removeSpinner();

  if (response.success && response.text) {
    const improvedText = response.text;
    const source = response.source;
    let replacementSuccess = false;

    try {
      if (source === 'gmail' && activeComposeWindow) {
        // Use existing Gmail logic (assuming selection is still valid in compose)
        // Ensure focus is in the compose window before executing command
        activeComposeWindow.focus();
        const success = document.execCommand('insertText', false, improvedText);
        if (success) {
          console.log('Successfully replaced selected text in Gmail composer.');
          replacementSuccess = true;
          // Optional: Show brief success confirmation in Gmail
          showBanner(activeComposeWindow, 'Text improved!', { type: 'info', timeout: 3000 });
        } else {
          console.warn('document.execCommand failed for Gmail composer.');
          // Fallback: Show error banner in Gmail
           showBanner(activeComposeWindow, 'Failed to insert improved text.', { type: 'error' });
        }
      } else if (source === 'generic') {
        // Generic improvement: inject into an input/textarea if available, else fallback to contenteditable
        let inputEl = null;
        if (lastInputSelection) {
          inputEl = lastInputSelection.element;
        } else if (lastSelectionRange) {
          let container = lastSelectionRange.commonAncestorContainer;
          container = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
          inputEl = container.closest('input, textarea');
        }
        if (inputEl) {
          try {
            inputEl.focus();
            if (lastInputSelection && typeof inputEl.setRangeText === 'function') {
              const { start, end } = lastInputSelection;
              inputEl.setRangeText(improvedText, start, end, 'end');
            } else {
              inputEl.value = improvedText;
              inputEl.setSelectionRange(improvedText.length, improvedText.length);
            }
            inputEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            console.log('Successfully replaced text in input/textarea.');
            replacementSuccess = true;
          } catch (e) {
            console.error('Error injecting text into input/textarea:', e);
          }
        } else if (lastSelectionRange) {
          // Fallback for contenteditable or static page replacement
          replacementSuccess = await replaceOrShowOverlay(lastSelectionRange, improvedText);
        }
      } else {
        // Other fallback logic...
        const currentSelection = window.getSelection();
        if (currentSelection && currentSelection.rangeCount > 0) {
          showOverlayNearSelection(currentSelection, improvedText);
          replacementSuccess = true;
        } else {
          alert(`AI Suggestion:\n\n${improvedText}`);
        }
      }
    } catch (error) {
      console.error('Error during text replacement:', error);
      if (source === 'generic') {
        // Generic fallback: simple alert
        alert(`AI Suggestion:\n\n${improvedText}`);
        replacementSuccess = true;
      } else if (activeComposeWindow) {
        showBanner(activeComposeWindow, `Error applying suggestion.`, { type: 'error' });
      }
    }

    // Set icon state based on outcome
    if (replacementSuccess) {
      await chrome.runtime.sendMessage({ type: 'SET_ICON_STATE', state: 'idle' });
    } else {
      await chrome.runtime.sendMessage({ type: 'SET_ICON_STATE', state: 'error' });
    }
  } else {
    // Error response handling...
  }
  lastSelectionRange = null;
  lastInputSelection = null;
  console.log('[handleImproveTextResult] Finished handling result.');
}

/**
 * Attempts to replace text in an editable element or shows an overlay.
 * @param {Range} selectionRange - The DOM Range object of the original selection.
 * @param {string} newText - The text to insert.
 * @returns {Promise<boolean>} - True if replacement or overlay was successful.
 */
async function replaceOrShowOverlay(selectionRange, newText) {
  try {
    const selection = window.getSelection();
    if (!selection || !selectionRange) return false;

    // Restore selection just before attempting replacement
    selection.removeAllRanges();
    selection.addRange(selectionRange);

    // Check if the selection is within an editable area
    let editableElement = null;
    if (selection.anchorNode) {
      editableElement = selection.anchorNode.nodeType === Node.ELEMENT_NODE ? selection.anchorNode : selection.anchorNode.parentElement;
    }
    // More robust check for editable elements
    const isEditable = editableElement && (
        editableElement.isContentEditable || 
        editableElement.tagName === 'TEXTAREA' || 
        (editableElement.tagName === 'INPUT' && /^(text|search|url|tel|email|password)$/i.test(editableElement.type))
    );

    if (isEditable) {
        console.log('Attempting direct replacement in editable element:', editableElement);
        // Focus the element before execCommand might help
        if(typeof editableElement.focus === 'function') editableElement.focus();
        const execSuccess = document.execCommand('insertText', false, newText);
        if (execSuccess) {
            console.log('Successfully replaced text via execCommand.');
            // Dispatch input event for frameworks like React/Vue
            try {
              editableElement.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            } catch (e) { console.warn("Could not dispatch input event", e); }
            return true; // Replacement successful
        } else {
            console.warn('execCommand("insertText") failed even in editable area.');
            return false;
        }
    } else {
        console.log('Selection not in an editable area.');
        return false; // Removed overlay fallback
    }
  } catch (error) {
    console.error('Error in replaceOrShowOverlay:', error);
    // Removed overlay fallback
    return false;
  }
}

// --- Action Trigger Functions --- 

/**
 * Finds the active compose window and triggers the "Generate Reply" modal.
 */
function triggerGenerateReply() {
  console.log('Attempting to trigger Generate Reply...');
  
  // Use the more robust findActiveComposeWindow function that has fallback logic
  const composeWindow = findActiveComposeWindow();
  if (!composeWindow) {
    console.log('TriggerGenerateReply: No compose window found on the page.');
    return;
  }

  console.log('TriggerGenerateReply: Active compose window found:', composeWindow);
  
  // Focus the compose window so the user knows which one will be used
  try {
    composeWindow.focus();
  } catch (e) {
    console.error('TriggerGenerateReply: Failed to focus compose window:', e);
  }
  
  // Extract context and store it before opening modal
  const emailContext = extractEmailContext(composeWindow);
  try {
    composeWindow.dataset.emailContext = emailContext;
  } catch (e) {
    console.error('TriggerGenerateReply: Failed to set email context on dataset:', e);
  }
  openModal(composeWindow);
}

/**
 * Finds the active compose window, gets selected text, and triggers the "Improve Text" flow.
 */
async function triggerImproveText() {
  console.log('Triggering Improve Text...');
  removeOverlay(); // Clear any previous overlay
  removeSpinner(); // Clear any previous spinner
  lastSelectionRange = null; // Reset stored selection range
  lastInputSelection = null; // Reset stored input selection

  // Determine selected text and record selection for replacement
  let selectedText = '';
  const activeEl = document.activeElement;
  if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && typeof activeEl.selectionStart === 'number') {
    // Input or textarea selection
    const start = activeEl.selectionStart;
    const end = activeEl.selectionEnd;
    selectedText = activeEl.value.substring(start, end).trim();
    lastInputSelection = { element: activeEl, start, end };
  } else {
    // Page text selection
    const selection = window.getSelection();
    selectedText = selection.toString().trim();
    if (selection.rangeCount > 0) {
      try {
        lastSelectionRange = selection.getRangeAt(0).cloneRange();
      } catch (e) {
        console.error('Could not clone selection range: ', e);
        lastSelectionRange = null;
      }
    }
  }

  if (!selectedText) {
    console.log('No text selected for improvement.');
    // Send message to background to show inactive icon state briefly
    try {
      chrome.runtime.sendMessage({ type: 'SET_ICON_STATE', state: 'inactive' }, response => {
        // Check for any runtime errors
        if (chrome.runtime.lastError) {
          console.error('Error sending SET_ICON_STATE message:', chrome.runtime.lastError.message);
        }
      });
    } catch (error) {
      console.error('Exception sending SET_ICON_STATE message:', error);
    }
    return;
  }

  // Show loading feedback (spinner locally, icon via background)
  showSpinnerNearSelection(window.getSelection());
  try {
    chrome.runtime.sendMessage({ type: 'SET_ICON_STATE', state: 'loading' }, response => {
      // Check for any runtime errors
      if (chrome.runtime.lastError) {
        console.error('Error sending loading icon state message:', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.error('Exception sending loading icon state message:', error);
  }

  try {
    // Determine context: Gmail composer or generic
    let source = 'generic';
    let emailContext = null;
    let activeComposeWindow = null;
    try {
      const gmailComposeSelector = 'div[contenteditable="true"][role="textbox"][aria-label="Message Body"]';
      // If selection was in a Gmail compose
      if (lastSelectionRange) {
        const container = lastSelectionRange.commonAncestorContainer;
        const elementContainer = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
        if (elementContainer && elementContainer.closest(gmailComposeSelector)) {
          activeComposeWindow = elementContainer.closest(gmailComposeSelector);
        }
      }
      // Also check focused element for Gmail compose
      if (!activeComposeWindow) {
        const focused = document.activeElement;
        if (focused) {
          activeComposeWindow = focused.closest(gmailComposeSelector);
        }
      }
      if (activeComposeWindow) {
        source = 'gmail';
        try { emailContext = extractEmailContext(activeComposeWindow); } catch (e) { console.error('Error extracting Gmail context:', e); }
      }
    } catch (e) {
      console.error('Error determining Gmail context:', e);
    }

    // Send message to background script
    console.log(`Sending IMPROVE_TEXT message (Source: ${source})`);
    // Send message fire-and-forget style.
    // The response will be handled by the main onMessage listener.
    chrome.runtime.sendMessage({
      type: 'IMPROVE_TEXT',
      selectedText,
      context: emailContext,
      source
    }, response => {
       // Check for immediate errors ONLY (like port closed)
       if (chrome.runtime.lastError) {
          console.error('IMMEDIATE Error sending IMPROVE_TEXT message:', chrome.runtime.lastError.message);
          removeSpinner();
          // Attempt to set error icon state
          try { chrome.runtime.sendMessage({ type: 'SET_ICON_STATE', state: 'error' }); } catch(e){} 
          alert(`Error sending message to background: ${chrome.runtime.lastError.message}`);
          // We cannot reliably get the async response here if there's an immediate error.
       } else {
           // This callback might receive the response if the background script is synchronous,
           // but we are relying on the main listener for the actual IMPROVE_TEXT_RESULT.
           console.log('[triggerImproveText] sendMessage callback received (response might be handled by main listener):', response);
           if (response && response.type === 'IMPROVE_TEXT_RESULT') {
             handleImproveTextResult(response);
           }
       }
    });
    console.log('TriggerImproveText: IMPROVE_TEXT message sent.');
  } catch (error) { // Catch synchronous errors during send attempt
    console.error('Synchronous exception sending IMPROVE_TEXT message:', error);
    removeSpinner();
    // Attempt to set error icon state
    try { chrome.runtime.sendMessage({ type: 'SET_ICON_STATE', state: 'error' }); } catch(e){} 
    alert(`Error initiating improvement: ${error.message}`);
  }
}

// Listen for messages from the background script (including command triggers)
if (
  typeof chrome !== 'undefined' &&
  chrome.runtime &&
  chrome.runtime.onMessage &&
  typeof chrome.runtime.onMessage.addListener === 'function'
) {
  chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    // Log ALL incoming messages immediately
    console.log(`[onMessage Listener] Received message type: ${message?.type}`, message);
  
    try {
      // Make this listener async to handle await for icon state changes
      if (message.type === 'TRIGGER_GENERATE') {
        console.log('Received TRIGGER_GENERATE from background.');
        triggerGenerateReply();
      } else if (message.type === 'TRIGGER_IMPROVE') {
        console.log('Received TRIGGER_IMPROVE from background.');
        await triggerImproveText(); // Now async
      } else if (message.type === 'IMPROVE_TEXT_RESULT') { 
        console.log("Received IMPROVE_TEXT_RESULT from background.");
        await handleImproveTextResult(message); // Now async
      } else {
        console.log('Received unhandled message type:', message.type);
      }
    } catch (error) {
        console.error('[onMessage Listener] Error processing message:', error);
        // Optionally send an error response if sendResponse is still valid
        // try { sendResponse({ success: false, error: error.message }); } catch (e) {}
    }
    
    // Indicate that the response will be sent asynchronously for async handlers
    return true; // Keep channel open for async operations within handlers
  });
}

// --- Main Execution ---

// Initialize Gmail-specific features ONLY on mail.google.com
const __IS_JEST__ = typeof process !== 'undefined' && process.env && process.env.JEST_WORKER_ID;

if (window.location.hostname === 'mail.google.com') {
  console.log('Running Gmail-specific initialization...');

  // First clean up any existing buttons (useful when reloading the extension)
  cleanupAllButtons();

  // Add event listener for Gmail's internal page changes
  window.addEventListener('hashchange', function() {
    console.log('URL hash changed, running injection logic again...');
    // Add a small delay after hash change before injecting
    setTimeout(injectIntoExistingWindows, 500); 
  });

  // Add a short delay before initializing to ensure Gmail DOM is fully rendered
  if (!__IS_JEST__) {
    setTimeout(() => {
      console.log('Initializing AI Reply Assistant...');
      injectIntoExistingWindows(); // Initial injection
      setupMutationObserver(); // Start observing for dynamic changes
    }, 500);
  }
} else {
  console.log('Not on mail.google.com, skipping Gmail-specific initialization.');
}

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

// Flag to indicate content script is loaded and ready
window.isGmailAiExtensionLoaded = true;

// Note: No ESM exports here to preserve compatibility when injected as a non-module content script

// --- UI Elements for Generic Improvement ---
let currentSpinner = null;
let currentOverlay = null;
let lastSelectionRange = null; // Store the last DOM Range for generic improvement
let lastInputSelection = null; // Store the last input/textarea selection for generic improvement

function showSpinnerNearSelection(selection) {
  removeSpinner(); // Remove any existing spinner
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Calculate position relative to the document, not just viewport
  const docScrollX = window.scrollX || document.documentElement.scrollLeft;
  const docScrollY = window.scrollY || document.documentElement.scrollTop;
 
  currentSpinner = document.createElement('div');
  currentSpinner.style.position = 'absolute';
  currentSpinner.style.left = `${docScrollX + rect.right + 5}px`; // Position to the right of selection
  currentSpinner.style.top = `${docScrollY + rect.top}px`;
  currentSpinner.style.width = '16px';
  currentSpinner.style.height = '16px';
  currentSpinner.style.border = '2px solid #ccc';
  currentSpinner.style.borderTopColor = '#333';
  currentSpinner.style.borderRadius = '50%';
  currentSpinner.style.animation = 'spin 1s linear infinite';
  currentSpinner.style.zIndex = '999999'; // High z-index
  currentSpinner.setAttribute('aria-label', 'Processing...');
  currentSpinner.setAttribute('role', 'status');

  document.body.appendChild(currentSpinner);

  // Add keyframes for animation if not already present
  const styleSheetId = 'ai-reply-styles';
  let styleSheet = document.getElementById(styleSheetId);
  if (!styleSheet) {
      styleSheet = document.createElement('style');
      styleSheet.id = styleSheetId;
      document.head.appendChild(styleSheet);
  }
  const sheet = styleSheet.sheet;
  let spinRuleExists = false;
  try {
    for (let i = 0; i < sheet.cssRules.length; i++) {
      if (sheet.cssRules[i].name === 'spin') {
        spinRuleExists = true;
        break;
      }
    }
  } catch (e) { /* Ignore DOMException for cross-origin stylesheets */ }

  if (!spinRuleExists) {
      try {
        sheet.insertRule(`@keyframes spin { to { transform: rotate(360deg); } }`, sheet.cssRules.length);
      } catch (e) {
        console.error("Could not insert CSS rule: ", e);
      }
  }
}

function removeSpinner() {
  if (currentSpinner && currentSpinner.parentNode) {
    currentSpinner.parentNode.removeChild(currentSpinner);
  }
  currentSpinner = null;
}

function showOverlayNearSelection(selection, improvedText) {
  removeOverlay(); // Remove existing overlay
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  // Calculate position relative to the document, not just viewport
  const docScrollX = window.scrollX || document.documentElement.scrollLeft;
  const docScrollY = window.scrollY || document.documentElement.scrollTop;
 
  currentOverlay = document.createElement('div');
  currentOverlay.style.position = 'absolute';
  currentOverlay.style.left = `${docScrollX + rect.left}px`;
  currentOverlay.style.top = `${docScrollY + rect.bottom + 5}px`; // Position below selection
  currentOverlay.style.backgroundColor = '#f8f9fa';
  currentOverlay.style.border = '1px solid #dee2e6';
  currentOverlay.style.borderRadius = '4px';
  currentOverlay.style.padding = '10px';
  currentOverlay.style.boxShadow = '0 2px 5px rgba(0,0,0,0.1)';
  currentOverlay.style.zIndex = '999998'; // High z-index, below spinner maybe
  currentOverlay.style.maxWidth = '400px';
  currentOverlay.style.fontSize = '13px';
  currentOverlay.style.lineHeight = '1.5';
  currentOverlay.style.fontFamily = 'sans-serif';

  const textElement = document.createElement('p');
  textElement.textContent = improvedText;
  textElement.style.margin = '0 0 10px 0';
  textElement.style.whiteSpace = 'pre-wrap'; // Preserve line breaks

  const copyButton = document.createElement('button');
  copyButton.textContent = 'Copy';
  copyButton.style.padding = '5px 10px';
  copyButton.style.border = '1px solid #007bff';
  copyButton.style.backgroundColor = '#007bff';
  copyButton.style.color = 'white';
  copyButton.style.borderRadius = '3px';
  copyButton.style.cursor = 'pointer';

  copyButton.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent dismissal
    navigator.clipboard.writeText(improvedText).then(() => {
      copyButton.textContent = 'Copied!';
      setTimeout(() => { if(copyButton) copyButton.textContent = 'Copy'; }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      copyButton.textContent = 'Error';
});
  });

  currentOverlay.appendChild(textElement);
  currentOverlay.appendChild(copyButton);
  document.body.appendChild(currentOverlay);

  // Dismissal logic
  const dismissHandler = (event) => {
    if (currentOverlay && !currentOverlay.contains(event.target)) {
        removeOverlay();
        document.removeEventListener('click', dismissHandler, { capture: true });
    }
  };
  // Use setTimeout to add listener slightly after creation to prevent immediate dismissal
  setTimeout(() => { 
      document.addEventListener('click', dismissHandler, { capture: true });
  }, 0);
}

function removeOverlay() {
  if (currentOverlay && currentOverlay.parentNode) {
    currentOverlay.parentNode.removeChild(currentOverlay);
    // Clean up event listeners if necessary (though `once: true` helps)
  }
  currentOverlay = null;
}

// --- End UI Elements ---

/**
 * Attempts to determine the currently active Gmail compose window.
 * It first looks at the current text selection, then the currently focused element,
 * and finally falls back to the first compose window found by getComposeWindows().
 * @returns {Element|null} The compose window element or null if not found.
 */
function findActiveComposeWindow() {
  // Check current selection
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const container = selection.getRangeAt(0).commonAncestorContainer;
    const elementContainer = container.nodeType === Node.ELEMENT_NODE ? container : container.parentElement;
    const gmailComposeSelector = 'div[contenteditable="true"][role="textbox"][aria-label="Message Body"]';
    if (elementContainer) {
      const compose = elementContainer.closest(gmailComposeSelector);
      if (compose) return compose;
    }
  }

  // Check focused element
  const focused = document.activeElement;
  if (focused) {
    const compose = focused.closest('div[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
    if (compose) return compose;
  }

  // Fallback: first compose window available
  const composeWindows = getComposeWindows();
  if (composeWindows && composeWindows.length > 0) {
    return composeWindows[0];
  }

  return null;
}