// Setup for both ES module environment and non-module environment
var exports = typeof exports !== 'undefined' ? exports : {};

/**
 * Returns a NodeList of Gmail compose window root elements using multiple selectors.
 * Gmail's DOM structure can change; this function uses multiple strategies to find compose windows.
 * @returns {NodeList} - Collection of compose window elements
 */
exports.getComposeWindows = function() {
  // Use multiple selectors to find compose windows in different Gmail versions/states
  const selectors = [
    '[aria-label="Message Body"]',
    '.Am.Al.editable',
    '[g_editable="true"]',
    '[role="textbox"][contenteditable="true"]',
    '.editable[contenteditable="true"]'
  ];
  
  // Combine all selectors for a single query
  const combinedSelector = selectors.join(', ');
  const potentialWindows = document.querySelectorAll(combinedSelector);
  
  console.log(`Found ${potentialWindows.length} potential compose windows`);
  
  // Filter out unlikely candidates (not direct user input areas)
  const composeWindows = Array.from(potentialWindows).filter(isLikelyComposeWindow);
  
  console.log(`Filtered to ${composeWindows.length} likely compose windows`);
  return composeWindows;
};

/**
 * Helper function to check if an element is likely a compose window
 * @param {Element} element - The element to check
 * @returns {boolean} - True if element is likely a compose window
 */
function isLikelyComposeWindow(element) {
  if (!element) return false;
  
  // Must be editable
  if (element.getAttribute('contenteditable') !== 'true' && 
      !element.classList.contains('editable') &&
      element.getAttribute('g_editable') !== 'true' &&
      element.getAttribute('aria-label') !== 'Message Body') {
    return false;
  }
  
  // Check context - should be in a dialog or compose area
  const inComposeArea = !!element.closest('[role="dialog"], .AD, .AO, [aria-label*="ompose"]');
  
  // Check size - compose windows are substantial in size
  const rect = element.getBoundingClientRect();
  const hasSubstantialSize = rect.width > 100 && rect.height > 50;
  
  // Check visibility
  const isVisible = rect.width > 0 && rect.height > 0 && 
                    window.getComputedStyle(element).display !== 'none' &&
                    window.getComputedStyle(element).visibility !== 'hidden';
  
  return inComposeArea && hasSubstantialSize && isVisible;
}

/**
 * Inserts the AI-generated draft into a Gmail compose window and positions the cursor at the end.
 * The draft is appended directly after any existing content without adding blank lines.
 * 
 * @param {Element} composeWindow - The Gmail compose window element (from getComposeWindows)
 * @param {string} draftText - The text to insert
 * @return {boolean} - True if successful, false otherwise
 */
exports.appendDraft = function(composeWindow, draftText) {
  try {
    if (!composeWindow || !draftText) {
      console.error('appendDraft: Missing required parameters', { composeWindow, draftText });
      return false;
    }

    // Find the editable area - might be the composeWindow itself or a child element
    let editableDiv = composeWindow;
    if (composeWindow.getAttribute('contenteditable') !== 'true') {
      editableDiv = composeWindow.querySelector('[contenteditable="true"]');
      if (!editableDiv) {
        // Try to find the editable area in a different way if first attempt fails
        editableDiv = composeWindow.querySelector('.editable') || 
                      composeWindow.querySelector('[g_editable="true"]') ||
                      document.activeElement;
      }
    }
    
    if (!editableDiv) {
      console.error('appendDraft: Could not find editable area in compose window');
      return false;
    }

    console.log('Found editable area:', editableDiv);

    // Remove Gmail's placeholder HTML (e.g., <br> or <div><br></div>) if the
    // compose window is otherwise empty to avoid a leading blank line
    if (editableDiv.textContent.trim() === '') {
      editableDiv.innerHTML = '';
    }

    // Check if there's existing content
    const hasExistingContent = editableDiv.textContent.trim().length > 0;
    
    // Create a document fragment to hold our insertion
    const fragment = document.createDocumentFragment();
    
    // If there's existing content but it doesn't end with a space, add a space
    if (hasExistingContent) {
      const lastChar = editableDiv.textContent.slice(-1);
      if (lastChar !== ' ' && lastChar !== '\n') {
        // Add a space between existing content and the draft
        const space = document.createTextNode(' ');
        fragment.appendChild(space);
      }
    }
    
    // Add the draft text
    const textNode = document.createTextNode(draftText);
    fragment.appendChild(textNode);
    
    // Append the fragment to the editable div
    editableDiv.appendChild(fragment);
    
    // Set focus to the compose window
    editableDiv.focus();
    
    // Set cursor at the end of the content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editableDiv);
    range.collapse(false); // Collapse to end
    selection.removeAllRanges();
    selection.addRange(range);
    
    // Trigger an input event to ensure Gmail recognizes the change
    try {
      // Use a more cross-environment compatible way to create an event
      let inputEvent;
      if (typeof window.Event === 'function') {
        // Modern browsers
        inputEvent = new window.Event('input', { bubbles: true });
      } else {
        // IE and older browsers
        inputEvent = document.createEvent('Event');
        inputEvent.initEvent('input', true, true);
      }
      editableDiv.dispatchEvent(inputEvent);
      
      // Also try dispatching a change event as some Gmail versions might listen for this
      try {
        const changeEvent = new Event('change', { bubbles: true });
        editableDiv.dispatchEvent(changeEvent);
      } catch (e) {
        console.warn('Could not dispatch change event');
      }
    } catch (eventError) {
      // If event dispatch fails, log it but don't fail the entire operation
      console.warn('Could not dispatch input event, but text was inserted:', eventError);
    }
    
    console.log('appendDraft: Successfully inserted draft');
    return true;
  } catch (error) {
    console.error('appendDraft: Error inserting draft', error);
    return false;
  }
};

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
exports.showBanner = function(composeWindow, message, options = {}) {
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
}; 