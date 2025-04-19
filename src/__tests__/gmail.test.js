import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JSDOM } from 'jsdom';
import { getComposeWindows, appendDraft } from '../utils/gmail.js';

describe('Gmail utils', () => {
  // Set up the DOM for tests
  let dom;
  let window;
  let document;
  // Create mocks to be used in tests
  let mockSelection;
  let mockRange;

  beforeEach(() => {
    // Create a mock Gmail compose window structure
    dom = new JSDOM(`
      <html>
        <body>
          <div aria-label="Message Body">
            <div contenteditable="true" class="editable">
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
      // Set up a compose window with no content
      const emptyComposeWindow = document.querySelector('[aria-label="Message Body"]');
      const editableDiv = emptyComposeWindow.querySelector('[contenteditable="true"]');
      editableDiv.textContent = '';
      
      // Mock the dispatchEvent to prevent JSDOM issues
      editableDiv.dispatchEvent = jest.fn();
      
      // Call appendDraft with test text
      const draftText = 'Test draft response';
      const result = appendDraft(emptyComposeWindow, draftText);
      
      // Check result and content
      expect(result).toBe(true);
      expect(editableDiv.textContent).toBe(draftText);
    });
    
    it('should append draft text after existing content', () => {
      // Set up a compose window with existing content
      const composeWindow = document.querySelector('[aria-label="Message Body"]');
      const editableDiv = composeWindow.querySelector('[contenteditable="true"]');
      editableDiv.textContent = 'Existing content';
      
      // Mock the dispatchEvent to prevent JSDOM issues
      editableDiv.dispatchEvent = jest.fn();
      
      // Call appendDraft with test text
      const draftText = 'Test draft response';
      const result = appendDraft(composeWindow, draftText);
      
      // Check result and content
      expect(result).toBe(true);
      expect(editableDiv.textContent).toBe('Existing content Test draft response');
    });
    
    it('should add a space between existing content and draft if needed', () => {
      // Set up a compose window with existing content that doesn't end with space
      const composeWindow = document.querySelector('[aria-label="Message Body"]');
      const editableDiv = composeWindow.querySelector('[contenteditable="true"]');
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
      const composeWindow = document.querySelector('[aria-label="Message Body"]');
      const editableDiv = composeWindow.querySelector('[contenteditable="true"]');
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
      const composeWindow = document.querySelector('[aria-label="Message Body"]');
      const result = appendDraft(composeWindow, '');
      expect(result).toBe(false);
    });
    
    it('should return false if editable area not found', () => {
      // Create a compose window without an editable area
      const invalidComposeWindow = document.createElement('div');
      invalidComposeWindow.setAttribute('aria-label', 'Message Body');
      document.body.appendChild(invalidComposeWindow);
      
      const result = appendDraft(invalidComposeWindow, 'Test draft');
      expect(result).toBe(false);
    });
    
    it('should trigger an input event on the editable div', () => {
      const composeWindow = document.querySelector('[aria-label="Message Body"]');
      const editableDiv = composeWindow.querySelector('[contenteditable="true"]');
      
      // Mock dispatchEvent
      editableDiv.dispatchEvent = jest.fn();
      
      appendDraft(composeWindow, 'Test draft');
      
      // Check if dispatchEvent was called
      expect(editableDiv.dispatchEvent).toHaveBeenCalledTimes(1);
      expect(editableDiv.dispatchEvent.mock.calls[0][0]).toBeTruthy();
    });
    
    it('should set cursor at the end of the content', () => {
      const composeWindow = document.querySelector('[aria-label="Message Body"]');
      const editableDiv = composeWindow.querySelector('[contenteditable="true"]');
      
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