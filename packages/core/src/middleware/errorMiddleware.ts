import { Middleware, MiddlewareContext } from '../middleware';
import { toAxionveraError } from '../errors/axionveraError';

export function createErrorMiddleware(): Middleware {
  return {
    name: 'errorHandler',
    priority: 100,
    onRequest: async (context: MiddlewareContext) => {
      // Pass through - errors are caught on response
      return context;
    },
    onResponse: async (context: MiddlewareContext) => {
      if (context.error) {
        const normalized = toAxionveraError(context.error);
        return {
          ...context,
          error: normalized,
        };
      }
      return context;
    },
  };
}