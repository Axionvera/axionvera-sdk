import type {
  EnvironmentConfig,
  EnvironmentId,
  EnvironmentOptions,
  EnvironmentSwitchResult,
  EnvironmentChangeListener,
  EnvironmentValidationResult,
  EnvironmentValidationIssue,
  EnvironmentTier,
} from '../types';
import { ENVIRONMENT_PRESETS, buildEnvironmentConfig } from './environmentPresets';

/**
 * Manages multiple Stellar/Soroban environments, supporting registration,
 * runtime switching, validation, and change notifications.
 *
 * @example
 * ```typescript
 * const manager = new EnvironmentManager();
 *
 * // Register a custom environment
 * manager.register({ tier: 'local', rpcUrl: 'http://localhost:8000/soroban/rpc' });
 *
 * // Switch to it
 * manager.switch('local');
 *
 * // Listen for changes
 * manager.onChange((result) => {
 *   console.log(`Switched from ${result.previous} to ${result.current}`);
 * });
 * ```
 */
export class EnvironmentManager {
  private readonly registry: Map<EnvironmentId, EnvironmentConfig> = new Map();
  private activeId: EnvironmentId | null = null;
  private listeners: Set<EnvironmentChangeListener> = new Set();

  /**
   * Creates an EnvironmentManager, optionally pre-loading built-in presets.
   * @param loadPresets - Whether to register the four canonical presets (default: true).
   */
  constructor(loadPresets = true) {
    if (loadPresets) {
      for (const preset of Object.values(ENVIRONMENT_PRESETS)) {
        this.registry.set(preset.id, { ...preset });
      }
    }
  }

  // ── Registration ──────────────────────────────────────────────

  /**
   * Registers a new environment or overrides an existing one.
   * Returns the full resolved configuration.
   */
  register(options: EnvironmentOptions): EnvironmentConfig {
    const id = options.id ?? options.tier;
    const config = buildEnvironmentConfig(options.tier, {
      id,
      name: options.name,
      rpcUrl: options.rpcUrl,
      networkPassphrase: options.networkPassphrase,
      horizonUrl: options.horizonUrl,
      faucetUrl: options.faucetUrl,
      allowHttp: options.allowHttp,
      description: options.description,
      metadata: options.metadata,
    });

    this.registry.set(id, config);
    return config;
  }

  /**
   * Removes an environment from the registry.
   * Throws if the environment is currently active.
   */
  unregister(id: EnvironmentId): boolean {
    if (id === this.activeId) {
      throw new Error(
        `Cannot unregister the currently active environment "${id}". Switch to another environment first.`,
      );
    }
    return this.registry.delete(id);
  }

  // ── Switching ─────────────────────────────────────────────────

  /**
   * Switches to the specified environment.
   * Validates the configuration before switching.
   * Fires change listeners on success.
   */
  switch(id: EnvironmentId): EnvironmentSwitchResult {
    const config = this.registry.get(id);
    if (!config) {
      throw new Error(
        `Environment "${id}" is not registered. Available environments: ${this.listIds().join(', ') || '(none)'}`,
      );
    }

    const validation = this.validate(id);
    if (!validation.valid) {
      const messages = validation.issues.map((i) => `${i.field}: ${i.message}`).join('; ');
      throw new Error(`Environment "${id}" validation failed: ${messages}`);
    }

    const previous = this.activeId;
    this.activeId = id;

    const result: EnvironmentSwitchResult = {
      previous,
      current: id,
      config: { ...config },
    };

    this.notifyListeners(result);
    return result;
  }

  // ── Querying ──────────────────────────────────────────────────

  /** Returns the currently active environment id, or null. */
  getActiveId(): EnvironmentId | null {
    return this.activeId;
  }

  /** Returns the full config of the active environment, or null. */
  getActive(): EnvironmentConfig | null {
    if (!this.activeId) return null;
    return this.registry.get(this.activeId) ?? null;
  }

  /** Returns the config for a specific environment. */
  get(id: EnvironmentId): EnvironmentConfig | undefined {
    return this.registry.get(id);
  }

  /** Returns all registered environment ids. */
  listIds(): EnvironmentId[] {
    return Array.from(this.registry.keys());
  }

  /** Returns all registered environment configs. */
  list(): EnvironmentConfig[] {
    return Array.from(this.registry.values());
  }

  /** Returns the number of registered environments. */
  size(): number {
    return this.registry.size;
  }

  /** Returns true if the given environment id is registered. */
  has(id: EnvironmentId): boolean {
    return this.registry.has(id);
  }

  /** Returns all environments belonging to a given tier. */
  listByTier(tier: EnvironmentTier): EnvironmentConfig[] {
    return this.list().filter((env) => env.tier === tier);
  }

  // ── Validation ────────────────────────────────────────────────

  /**
   * Validates an environment's configuration.
   * Checks RPC URL format, passphrase presence, and tier/network consistency.
   */
  validate(id: EnvironmentId): EnvironmentValidationResult {
    const issues: EnvironmentValidationIssue[] = [];
    const config = this.registry.get(id);

    if (!config) {
      return {
        valid: false,
        issues: [{ field: 'id', message: `Environment "${id}" is not registered` }],
      };
    }

    // RPC URL must be present and have a protocol
    if (!config.rpcUrl || config.rpcUrl.trim().length === 0) {
      issues.push({ field: 'rpcUrl', message: 'RPC URL is required' });
    } else if (
      !config.rpcUrl.startsWith('http://') &&
      !config.rpcUrl.startsWith('https://')
    ) {
      issues.push({
        field: 'rpcUrl',
        message: 'RPC URL must start with http:// or https://',
      });
    }

    // Network passphrase must be present
    if (!config.networkPassphrase || config.networkPassphrase.trim().length === 0) {
      issues.push({
        field: 'networkPassphrase',
        message: 'Network passphrase is required',
      });
    }

    // Tier must be valid
    const validTiers: EnvironmentTier[] = ['local', 'testnet', 'futurenet', 'mainnet'];
    if (!validTiers.includes(config.tier as EnvironmentTier)) {
      issues.push({
        field: 'tier',
        message: `Invalid tier "${config.tier}". Must be one of: ${validTiers.join(', ')}`,
      });
    }

    // Mainnet must use HTTPS unless explicitly allowed
    if (
      config.tier === 'mainnet' &&
      config.rpcUrl?.startsWith('http://') &&
      !config.allowHttp
    ) {
      issues.push({
        field: 'rpcUrl',
        message:
          'Mainnet environments must use HTTPS. Set allowHttp: true to override (not recommended).',
      });
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Validates all registered environments.
   * Returns a map of environment id to validation result.
   */
  validateAll(): Map<EnvironmentId, EnvironmentValidationResult> {
    const results = new Map<EnvironmentId, EnvironmentValidationResult>();
    for (const id of this.registry.keys()) {
      results.set(id, this.validate(id));
    }
    return results;
  }

  // ── Events ────────────────────────────────────────────────────

  /**
   * Registers a listener for environment switch events.
   * Returns an unsubscribe function.
   */
  onChange(listener: EnvironmentChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Removes all change listeners. */
  clearListeners(): void {
    this.listeners.clear();
  }

  // ── Internal ──────────────────────────────────────────────────

  private notifyListeners(result: EnvironmentSwitchResult): void {
    for (const listener of this.listeners) {
      try {
        listener(result);
      } catch {
        // Silently ignore listener errors to prevent cascading failures.
      }
    }
  }
}
