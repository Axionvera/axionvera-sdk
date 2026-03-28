// E2E test setup for MSW
import { server } from '../../src/test/msw/server';

// Setup MSW server for all E2E tests
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error'
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  // Uncomment to ignore specific console methods during tests
  // log: jest.fn(),
  // debug: jest.fn(),
  // info: jest.fn(),
  // warn: jest.fn(),
  // error: jest.fn(),
};
