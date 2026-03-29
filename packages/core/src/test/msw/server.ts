import { setupServer } from 'msw/node';
import { handlers } from './handlers';

// Setup MSW server with all handlers
export const server = setupServer(...handlers);

// Helper functions for test setup
export const setupMswTest = () => {
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
};

// Helper to override handlers for specific tests
export const overrideHandlers = (...newHandlers: any[]) => {
  server.use(...newHandlers);
};
