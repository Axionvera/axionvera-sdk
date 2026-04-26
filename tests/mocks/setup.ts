import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with JSON-RPC handlers
export const server = setupServer(...handlers);

// Establish API mocking before all unit tests.
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error',
  });
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());
