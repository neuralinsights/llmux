/**
 * Jest Test Setup
 * Global configuration for all tests
 */

// Suppress console output during tests unless DEBUG=true
if (!process.env.DEBUG) {
  global.console = {
    ...console,
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    // Keep error for debugging failed tests
    error: console.error,
  };
}

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port
process.env.API_KEY_REQUIRED = 'false';
process.env.CACHE_TTL = '1000';
process.env.CACHE_MAX_SIZE = '100';

// Increase timeout for integration tests
jest.setTimeout(30000);

// Clean up after all tests
afterAll(async () => {
  // Allow pending timers to clear
  await new Promise(resolve => setTimeout(resolve, 100));
});
