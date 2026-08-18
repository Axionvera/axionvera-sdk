export interface MiddlewareContext {
  error?: unknown;
}

export interface Middleware {
  name: string;
  priority?: number;
  onRequest?(context: MiddlewareContext): MiddlewareContext | Promise<MiddlewareContext>;
  onResponse?(context: MiddlewareContext): MiddlewareContext | Promise<MiddlewareContext>;
}
