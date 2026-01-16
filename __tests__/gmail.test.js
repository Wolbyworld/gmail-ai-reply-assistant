import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { getComposeWindows, appendDraft } from '../src/utils/gmail.js';

describe('Gmail utils', () => {
  // Set up the DOM for tests
  let dom;
  let window;
  let document;
  // Create mocks to be used in tests
  let mockSelection;
  let mockRange;

  beforeEach(() => {
    // Bug #2 fix: Create a mock Gmail compose window structure that matches real Gmail
    dom = new JSDOM(`
      <html>
        <body>
          <!-- Mock Gmail compose container -->
          <div class="AD">
            <!-- The actual compose window with all required attributes -->
            <div contenteditable="true" role="textbox" aria-label="Message Body" class="Am Al editable">
              Initial content
            </div>
          </div>
        </body>
      </html>
    `);

    window = dom.window;
    document = window.document;
    
    // Mock required browser APIs
    global.document = document;
    global.window = window;
    global.Node = window.Node;
    
    // Create selection mocks
    mockSelection = {
      removeAllRanges: jest.fn(),
      addRange: jest.fn()
    };
    
    mockRange = {
      selectNodeContents: jest.fn(),
      collapse: jest.fn()
    };
    
    // Set up the mock getSelection and createRange
    window.getSelection = jest.fn().mockReturnValue(mockSelection);
    window.document.createRange = jest.fn().mockReturnValue(mockRange);

    // Setup Event constructor for JSDOM
    if (typeof window.Event !== 'function') {
      window.Event = function(type, options) {
        const event = document.createEvent('Event');
        event.initEvent(type, options.bubbles || false, options.cancelable || false);
        return event;
      };
    }

    // Bug #2 fix: Mock getBoundingClientRect for JSDOM (returns 0x0 by default)
    window.Element.prototype.getBoundingClientRect = jest.fn(function() {
      return {
        width: 600,
        height: 400,
        top: 0,
        left: 0,
        bottom: 400,
        right: 600,
        x: 0,
        y: 0,
        toJSON: () => {}
      };
    });

    // Bug #2 fix: Mock getComputedStyle for JSDOM
    window.getComputedStyle = jest.fn().mockReturnValue({
      display: 'block',
      visibility: 'visible',
      getPropertyValue: (prop) => {
        if (prop === 'display') return 'block';
        if (prop === 'visibility') return 'visible';
        return '';
      }
    });
  });

  describe('getComposeWindows', () => {
    it('should return all compose windows', () => {
      const windows = getComposeWindows();
      expect(windows.length).toBe(1);
      expect(windows[0].getAttribute('aria-label')).toBe('Message Body');
    });
  });

  describe('appendDraft', () => {
    it('should append draft text to an empty compose window', () => {
      // Bug #2 fix: The compose window IS the contenteditable element
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      composeWindow.textContent = '';

      // Mock the dispatchEvent to prevent JSDOM issues
      composeWindow.dispatchEvent = jest.fn();

      // Call appendDraft with test text
      const draftText = 'Test draft response';
      const result = appendDraft(composeWindow, draftText);

      // Check result and content
      expect(result).toBe(true);
      expect(composeWindow.textContent).toBe(draftText);
    });
    
    it('should append draft text after existing content', () => {
      // Bug #2 fix: composeWindow IS the editable element
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      composeWindow.textContent = 'Existing content';

      // Mock the dispatchEvent to prevent JSDOM issues
      composeWindow.dispatchEvent = jest.fn();

      // Call appendDraft with test text
      const draftText = 'Test draft response';
      const result = appendDraft(composeWindow, draftText);

      // Check result and content
      expect(result).toBe(true);
      expect(composeWindow.textContent).toBe('Existing content Test draft response');
    });
    
    it('should add a space between existing content and draft if needed', () => {
      // Set up a compose window with existing content that doesn't end with space
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      // Bug #2 fix: composeWindow IS the editable element
      const editableDiv = composeWindow;
      editableDiv.textContent = 'Existing content without space';
      
      // Mock the dispatchEvent to prevent JSDOM issues
      editableDiv.dispatchEvent = jest.fn();
      
      // Call appendDraft with test text
      const draftText = 'Test draft response';
      const result = appendDraft(composeWindow, draftText);
      
      // Check result and content
      expect(result).toBe(true);
      expect(editableDiv.textContent).toBe('Existing content without space Test draft response');
    });
    
    it('should not add a space if existing content already ends with space or newline', () => {
      // Set up a compose window with existing content that ends with space
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      // Bug #2 fix: composeWindow IS the editable element
      const editableDiv = composeWindow;
      editableDiv.textContent = 'Existing content with space ';
      
      // Mock the dispatchEvent to prevent JSDOM issues
      editableDiv.dispatchEvent = jest.fn();
      
      // Call appendDraft with test text
      const draftText = 'Test draft response';
      const result = appendDraft(composeWindow, draftText);
      
      // Check result and content
      expect(result).toBe(true);
      expect(editableDiv.textContent).toBe('Existing content with space Test draft response');
    });
    
    it('should return false if compose window is not provided', () => {
      const result = appendDraft(null, 'Test draft');
      expect(result).toBe(false);
    });
    
    it('should return false if draft text is empty', () => {
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      const result = appendDraft(composeWindow, '');
      expect(result).toBe(false);
    });
    
    it('should return false if editable area not found', () => {
      // Create a compose window without an editable area
      const invalidComposeWindow = document.createElement('div');
      invalidComposeWindow.setAttribute('aria-label', 'Message Body');
      document.body.appendChild(invalidComposeWindow);

      // Bug #2 fix: Mock activeElement to prevent fallback
      const originalActiveElement = Object.getOwnPropertyDescriptor(document, 'activeElement');
      Object.defineProperty(document, 'activeElement', {
        get: () => null,
        configurable: true
      });

      const result = appendDraft(invalidComposeWindow, 'Test draft');
      expect(result).toBe(false);

      // Restore activeElement
      if (originalActiveElement) {
        Object.defineProperty(document, 'activeElement', originalActiveElement);
      }
    });
    
    it('should trigger an input event on the editable div', () => {
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      // Bug #2 fix: composeWindow IS the editable element
      const editableDiv = composeWindow;

      // Mock dispatchEvent
      editableDiv.dispatchEvent = jest.fn();

      appendDraft(composeWindow, 'Test draft');

      // Bug #2 fix: appendDraft dispatches TWO events - 'input' and 'change'
      expect(editableDiv.dispatchEvent).toHaveBeenCalledTimes(2);
      expect(editableDiv.dispatchEvent.mock.calls[0][0]).toBeTruthy(); // First call (input event)
      expect(editableDiv.dispatchEvent.mock.calls[1][0]).toBeTruthy(); // Second call (change event)
    });
    
    it('should set cursor at the end of the content', () => {
      const composeWindow = document.querySelector('[contenteditable="true"][role="textbox"][aria-label="Message Body"]');
      // Bug #2 fix: composeWindow IS the editable element
      const editableDiv = composeWindow;
      
      // Mock the dispatchEvent to prevent JSDOM issues
      editableDiv.dispatchEvent = jest.fn();
      
      // Make sure our mock is properly setup
      expect(window.getSelection).toBeDefined();
      expect(typeof window.getSelection).toBe('function');
      
      // Call our function
      appendDraft(composeWindow, 'Test draft');
      
      // Verify mocks were called
      expect(window.getSelection).toHaveBeenCalled();
      expect(window.document.createRange).toHaveBeenCalled();
      expect(mockSelection.removeAllRanges).toHaveBeenCalled();
      expect(mockSelection.addRange).toHaveBeenCalled();
      expect(mockRange.selectNodeContents).toHaveBeenCalledWith(editableDiv);
      expect(mockRange.collapse).toHaveBeenCalledWith(false); // Should collapse to end
    });
  });
}); 