import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock chrome.storage API
const mockStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn(),
  },
};
global.chrome = { storage: mockStorage };

// Import functions to test AFTER mocks are set up
import { getSettings, setSettings } from '../storage.js';

// Define defaults here for comparison (should match storage.js)
const DEFAULT_SETTINGS = {
  apiKey: '',
  model: 'gpt-4.1',
  promptTemplate: `Write a draft response to the emails below in the context. Keep it simple, respect my tone (normally informal) and the language of the email chain.\n\nThese are talking points:\n[Bullet_points]\n\nEmail context:\n[Email_context]`,
};

const SETTINGS_KEY = 'ai-reply.settings';

describe('Storage Utilities', () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockStorage.sync.get.mockReset();
    mockStorage.sync.set.mockReset();
  });

describe('getSettings', () => {
    it('should return default settings if nothing is stored', async () => {
      // Simulate storage returning empty object for the key
      mockStorage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: {} }); 
      
      const settings = await getSettings();
      
      expect(settings).toEqual(DEFAULT_SETTINGS);
      expect(mockStorage.sync.get).toHaveBeenCalledWith({ [SETTINGS_KEY]: {} });
    });

    it('should return stored settings merged with defaults', async () => {
      const stored = { apiKey: 'test-key', model: 'gpt-4.5' };
      mockStorage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: stored });
      
      const settings = await getSettings();
      
      expect(settings).toEqual({ ...DEFAULT_SETTINGS, ...stored });
      expect(mockStorage.sync.get).toHaveBeenCalledWith({ [SETTINGS_KEY]: {} });
    });

    it('should handle cases where storage explicitly returns undefined/null for the key', async () => {
        mockStorage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: undefined });
        let settings = await getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);

        mockStorage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: null });
        settings = await getSettings();
        expect(settings).toEqual(DEFAULT_SETTINGS);
    });

    it('should return defaults if chrome.storage.sync.get throws an error', async () => {
      const testError = new Error('Storage failed');
      mockStorage.sync.get.mockRejectedValue(testError);
      
      const settings = await getSettings();
      
      expect(settings).toEqual(DEFAULT_SETTINGS);
      // Optionally check console.error was called
    });
  });

describe('setSettings', () => {
    it('should save merged settings correctly', async () => {
      const initialStored = { apiKey: 'old-key', model: 'gpt-4.1' };
      const partialUpdate = { apiKey: 'new-key', promptTemplate: 'New prompt' };
      const expectedSaved = {
        ...DEFAULT_SETTINGS, // Ensure defaults are included
        ...initialStored,    // Apply initial stored values
        ...partialUpdate,    // Apply partial updates
      };

      // Mock get to return initial state
      mockStorage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: initialStored });
      // Mock set to resolve successfully (doesn't need to return anything)
      mockStorage.sync.set.mockResolvedValue(undefined);

      const success = await setSettings(partialUpdate);

      expect(success).toBe(true);
      // Verify get was called first (by setSettings internally)
      expect(mockStorage.sync.get).toHaveBeenCalledWith({ [SETTINGS_KEY]: {} });
      // Verify set was called with the correctly merged object
      expect(mockStorage.sync.set).toHaveBeenCalledWith({ [SETTINGS_KEY]: expectedSaved });
    });

    it('should handle setting initial values when storage is empty', async () => {
        const partialUpdate = { apiKey: 'first-key' };
        const expectedSaved = { ...DEFAULT_SETTINGS, ...partialUpdate };

        // Simulate empty storage
        mockStorage.sync.get.mockResolvedValue({});
        mockStorage.sync.set.mockResolvedValue(undefined);

        const success = await setSettings(partialUpdate);

        expect(success).toBe(true);
        expect(mockStorage.sync.get).toHaveBeenCalledWith({ [SETTINGS_KEY]: {} });
        expect(mockStorage.sync.set).toHaveBeenCalledWith({ [SETTINGS_KEY]: expectedSaved });
    });

    it('should return false and not call set if partialSettings are invalid', async () => {
        const success1 = await setSettings(null);
        expect(success1).toBe(false);
        expect(mockStorage.sync.set).not.toHaveBeenCalled();

        const success2 = await setSettings('invalid');
        expect(success2).toBe(false);
        expect(mockStorage.sync.set).not.toHaveBeenCalled();
    });

    it('should return false if chrome.storage.sync.set throws an error', async () => {
      const testError = new Error('Storage set failed');
      // Mock get to return something simple
      mockStorage.sync.get.mockResolvedValue({ [SETTINGS_KEY]: {} });
      // Mock set to throw an error
      mockStorage.sync.set.mockRejectedValue(testError);

      const success = await setSettings({ apiKey: 'test' });

      expect(success).toBe(false);
      expect(mockStorage.sync.set).toHaveBeenCalled(); // It should still attempt to set
      // Optionally check console.error
    });
  });
}); 