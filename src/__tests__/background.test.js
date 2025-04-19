import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';

// Mock Chrome APIs
global.chrome = {
  runtime: {
    onMessage: {
      addListener: jest.fn()
    }
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// Mock fetch
global.fetch = jest.fn();

describe('Background Script Message Handling', () => {
  let handleMessage;
  
  // Mock settings for tests
  const mockSettings = {
    apiKey: 'test-api-key',
    model: 'gpt-4.1',
    promptTemplate: 'Test template with [Bullet_points] and [Email_context]'
  };

  beforeEach(async () => {
    jest.resetModules();
    
    // Suppress console logs/errors during tests
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock import result of getSettings to return our test settings
    jest.mock('../utils/storage.js', () => ({
      getSettings: () => Promise.resolve(mockSettings)
    }), { virtual: true });
    
    // Load the module
    const backgroundModule = await import('../background.js');
    
    // Extract and store the message handler function
    const mockListenerAdd = global.chrome.runtime.onMessage.addListener;
    if (mockListenerAdd.mock.calls.length > 0) {
      handleMessage = mockListenerAdd.mock.calls[0][0];
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    global.fetch.mockClear();
  });

  it('should register a message listener on load', async () => {
    expect(global.chrome.runtime.onMessage.addListener).toHaveBeenCalled();
    expect(typeof handleMessage).toBe('function');
  });

  it('should process a generate message with valid settings', async () => {
    // Setup mock fetch for successful API call
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'This is a test draft response.' } }]
      })
    });

    // Create mock request
    const message = {
      type: 'generate',
      bulletPoints: 'Point 1\nPoint 2',
      emailContext: 'Email context here'
    };
    
    // Create spy for sendResponse
    const sendResponse = jest.fn();

    // Call the handler
    handleMessage(message, {}, sendResponse);
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Check that fetch was called with proper OpenAI parameters
    expect(fetch).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': `Bearer ${mockSettings.apiKey}`
        }),
        body: expect.any(String)
      })
    );
    
    // Verify response was sent back
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      draft: 'This is a test draft response.'
    });
  });

  it('should handle API errors gracefully', async () => {
    // Setup mock fetch for failed API call
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized'
    });

    // Create mock request
    const message = {
      type: 'generate',
      bulletPoints: 'Test points',
      emailContext: 'Test context'
    };
    
    // Create spy for sendResponse
    const sendResponse = jest.fn();

    // Call the handler
    handleMessage(message, {}, sendResponse);
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify error response was sent
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: expect.stringContaining('OpenAI API error (401)')
    });
  });

  it('should return settings for getSettings message', async () => {
    // Create mock request
    const message = { type: 'getSettings' };
    
    // Create spy for sendResponse
    const sendResponse = jest.fn();

    // Call the handler
    handleMessage(message, {}, sendResponse);
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify settings were returned
    expect(sendResponse).toHaveBeenCalledWith({
      success: true,
      settings: mockSettings
    });
  });

  it('should handle unknown message types', async () => {
    // Create mock request with unknown type
    const message = { type: 'unknown' };
    
    // Create spy for sendResponse
    const sendResponse = jest.fn();

    // Call the handler
    handleMessage(message, {}, sendResponse);
    
    // Wait for promises to resolve
    await new Promise(process.nextTick);
    
    // Verify error response
    expect(sendResponse).toHaveBeenCalledWith({
      success: false,
      error: 'Unknown message type'
    });
  });
}); 