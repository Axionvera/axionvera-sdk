import {
  PluginConfig,
  PluginInstance,
  PluginManagerConfig,
  PluginLifecycleState,
} from './types';
import {
  validatePlugin,
  validateDependencies,
  topologicalSort,
} from './validation';
import { transitionState, isValidTransition } from './lifecycle';
import type { StellarClient, StellarClientOptions } from '../client';
import type { ServiceOverrides } from '../core';
import type { Middleware } from '../middleware';

/**
 * PluginManager orchestrates the full lifecycle of plugins:
 * registration → validation → installation → activation.
 *
 * It enforces lifecycle transitions, validates compatibility and
 * dependencies, and integrates plugins with StellarClient instances.
 */
export class PluginManager {
  private plugins: Map<string, PluginInstance> = new Map();
  private config: Required<PluginManagerConfig>;
  private clients: Set<StellarClient> = new Set();

  constructor(config: PluginManagerConfig = {}) {
    this.config = {
      autoInstall: config.autoInstall ?? false,
      autoEnable: config.autoEnable ?? true,
      validateOnRegister: config.validateOnRegister ?? true,
      sdkVersion: config.sdkVersion ?? '0.0.0',
      allowIncompatible: config.allowIncompatible ?? false,
    };
  }

  // ── Registration ───────────────────────────────────────────────────

  /**
   * Register a plugin. Validates the config, then optionally auto-installs
   * and auto-enables.
   */
  register(plugin: PluginConfig): PluginManager {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin with id "${plugin.id}" is already registered.`);
    }

    // Validate plugin configuration
    if (this.config.validateOnRegister) {
      const result = validatePlugin(plugin, this.config.sdkVersion);
      if (!result.valid && !this.config.allowIncompatible) {
        throw new Error(
          `Plugin "${plugin.id}" validation failed:\n${result.errors.join('\n')}`,
        );
      }
    }

    const instance: PluginInstance = {
      config: plugin,
      state: PluginLifecycleState.Unregistered,
      registeredAt: new Date(),
    };

    // Transition to Registered
    instance.state = transitionState(
      plugin.id,
      instance.state,
      PluginLifecycleState.Registered,
    );

    // Store the validation result
    instance.lastValidation = validatePlugin(plugin, this.config.sdkVersion);

    this.plugins.set(plugin.id, instance);

    // Fire onRegister hook
    if (plugin.hooks?.onRegister) {
      Promise.resolve(plugin.hooks.onRegister()).catch((err) => {
        this.setPluginError(instance, err as Error);
      });
    }

    // Auto-install
    if (this.config.autoInstall) {
      // Fire and forget – caller can await installAll() if needed
      this.install(plugin.id).catch((err) => {
        this.setPluginError(instance, err as Error);
      });
    }

    return this;
  }

  /**
   * Unregister a plugin. Uninstalls first if needed.
   */
  async unregister(pluginId: string): Promise<PluginManager> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin with id "${pluginId}" not found.`);
    }

    // Check that no other installed plugin depends on this one
    const dependents = this.getDependentsOf(pluginId);
    const installedDependents = dependents.filter((id) => {
      const p = this.plugins.get(id);
      return p && p.state !== PluginLifecycleState.Uninstalled;
    });

    if (installedDependents.length > 0) {
      throw new Error(
        `Cannot unregister "${pluginId}" — it is a dependency of: ${installedDependents.join(', ')}`,
      );
    }

    // Uninstall first if installed or active
    if (
      instance.state === PluginLifecycleState.Installed ||
      instance.state === PluginLifecycleState.Active
    ) {
      await this.uninstall(pluginId);
    }

    // Transition to Uninstalled if not already
    if (isValidTransition(instance.state, PluginLifecycleState.Uninstalled)) {
      instance.state = transitionState(
        pluginId,
        instance.state,
        PluginLifecycleState.Uninstalled,
      );
    }

    this.plugins.delete(pluginId);
    return this;
  }

  // ── Installation ───────────────────────────────────────────────────

  /**
   * Install a plugin: validate dependencies, then run the onInstall hook.
   * Installed plugins are ready to be activated.
   */
  async install(pluginId: string): Promise<PluginManager> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin with id "${pluginId}" not found.`);
    }

    if (
      instance.state === PluginLifecycleState.Installed ||
      instance.state === PluginLifecycleState.Active
    ) {
      return this; // Already installed
    }

    // Validate dependencies against currently installed plugins
    if (instance.config.dependencies && instance.config.dependencies.length > 0) {
      const installedMap = new Map(
        this.getInstalled().map((p) => [p.config.id, p]),
      );
      const depResult = validateDependencies(
        instance.config.dependencies,
        installedMap,
      );

      if (!depResult.valid) {
        throw new Error(
          `Cannot install "${pluginId}" — dependency check failed:\n${depResult.errors.join('\n')}`,
        );
      }

      if (depResult.warnings.length > 0) {
        // Log warnings but don't block
        for (const warning of depResult.warnings) {
          console.warn(`[PluginManager] ${warning}`);
        }
      }
    }

    // Install dependencies first (recursively)
    if (instance.config.dependencies) {
      for (const dep of instance.config.dependencies) {
        if (!dep.optional && this.plugins.has(dep.pluginId)) {
          const depInstance = this.plugins.get(dep.pluginId)!;
          if (
            depInstance.state !== PluginLifecycleState.Installed &&
            depInstance.state !== PluginLifecycleState.Active
          ) {
            await this.install(dep.pluginId);
          }
        }
      }
    }

    // Transition to Installed
    instance.state = transitionState(
      pluginId,
      instance.state,
      PluginLifecycleState.Installed,
    );
    instance.installedAt = new Date();

    // Fire onInstall hook
    try {
      if (instance.config.hooks?.onInstall) {
        await instance.config.hooks.onInstall();
      }
    } catch (err) {
      this.setPluginError(instance, err as Error);
      throw err;
    }

    // Auto-enable
    if (this.config.autoEnable) {
      await this.enable(pluginId);
    }

    return this;
  }

  /**
   * Uninstall a plugin: disable first, fire onUninstall, remove from clients.
   */
  async uninstall(pluginId: string): Promise<PluginManager> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin with id "${pluginId}" not found.`);
    }

    if (instance.state === PluginLifecycleState.Uninstalled) {
      return this;
    }

    // Disable first if active
    if (instance.state === PluginLifecycleState.Active) {
      await this.disable(pluginId);
    }

    // Fire onUninstall hook
    try {
      if (instance.config.hooks?.onUninstall) {
        await instance.config.hooks.onUninstall();
      }
    } catch (err) {
      this.setPluginError(instance, err as Error);
      // Continue with uninstall even if hook fails
    }

    // Transition to Uninstalled
    instance.state = transitionState(
      pluginId,
      instance.state,
      PluginLifecycleState.Uninstalled,
    );

    return this;
  }

  // ── Activation ─────────────────────────────────────────────────────

  /**
   * Enable (activate) a plugin so its hooks begin executing.
   */
  async enable(pluginId: string): Promise<PluginManager> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin with id "${pluginId}" not found.`);
    }

    if (instance.state === PluginLifecycleState.Active) return this;

    // Must be Installed or Disabled to enable
    instance.state = transitionState(
      pluginId,
      instance.state,
      PluginLifecycleState.Active,
    );

    try {
      if (instance.config.hooks?.onEnable) {
        await instance.config.hooks.onEnable();
      }
    } catch (err) {
      this.setPluginError(instance, err as Error);
      throw err;
    }

    return this;
  }

  /**
   * Disable a plugin temporarily (hooks paused, but still installed).
   */
  async disable(pluginId: string): Promise<PluginManager> {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new Error(`Plugin with id "${pluginId}" not found.`);
    }

    if (instance.state === PluginLifecycleState.Disabled) return this;

    instance.state = transitionState(
      pluginId,
      instance.state,
      PluginLifecycleState.Disabled,
    );

    try {
      if (instance.config.hooks?.onDisable) {
        await instance.config.hooks.onDisable();
      }
    } catch (err) {
      this.setPluginError(instance, err as Error);
      throw err;
    }

    return this;
  }

  // ── Bulk Operations ────────────────────────────────────────────────

  /**
   * Install all registered plugins in dependency order.
   */
  async installAll(): Promise<PluginManager> {
    const sorted = this.getDependencySorted();

    for (const pluginId of sorted) {
      const instance = this.plugins.get(pluginId);
      if (
        instance &&
        instance.state !== PluginLifecycleState.Installed &&
        instance.state !== PluginLifecycleState.Active
      ) {
        await this.install(pluginId);
      }
    }

    return this;
  }

  /**
   * Enable all installed (but not active) plugins.
   */
  async enableAll(): Promise<PluginManager> {
    for (const plugin of this.plugins.values()) {
      if (plugin.state === PluginLifecycleState.Installed) {
        await this.enable(plugin.config.id);
      }
    }
    return this;
  }

  // ── Client Integration ─────────────────────────────────────────────

  /**
   * Process client options through all *active* plugins.
   */
  async processClientOptions(
    options: StellarClientOptions,
  ): Promise<StellarClientOptions> {
    let processedOptions = { ...options };

    for (const plugin of this.getActive()) {
      if (plugin.config.hooks?.beforeClientInit) {
        try {
          processedOptions =
            (await plugin.config.hooks.beforeClientInit(processedOptions)) ??
            processedOptions;
        } catch (err) {
          this.setPluginError(plugin, err as Error);
        }
      }
    }

    return processedOptions;
  }

  /**
   * Apply all active plugins to a client.
   */
  async applyToClient(client: StellarClient): Promise<void> {
    this.clients.add(client);

    for (const plugin of this.getActive()) {
      await this.applyPluginToClient(plugin, client);
    }
  }

  /**
   * Get combined service overrides from all active plugins.
   * Later plugins override earlier ones (last-write-wins).
   */
  getServiceOverrides(): ServiceOverrides {
    const overrides: ServiceOverrides = {};

    for (const plugin of this.getActive()) {
      if (plugin.config.services) {
        Object.assign(overrides, plugin.config.services);
      }
    }

    return overrides;
  }

  /**
   * Get middleware from all active plugins.
   */
  getMiddleware(): Middleware[] {
    const middleware: Middleware[] = [];

    for (const plugin of this.getActive()) {
      if (plugin.config.middleware) {
        middleware.push(...plugin.config.middleware);
      }
    }

    return middleware;
  }

  // ── Queries ────────────────────────────────────────────────────────

  /** Get a plugin instance by ID. */
  get(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /** Get all registered plugins (any state). */
  getAll(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /** Get plugins that are Installed or Active. */
  getInstalled(): PluginInstance[] {
    return this.getAll().filter(
      (p) =>
        p.state === PluginLifecycleState.Installed ||
        p.state === PluginLifecycleState.Active,
    );
  }

  /** Get only active plugins. */
  getActive(): PluginInstance[] {
    return this.getAll().filter(
      (p) => p.state === PluginLifecycleState.Active,
    );
  }

  /** Get plugins in a specific state. */
  getByState(state: PluginLifecycleState): PluginInstance[] {
    return this.getAll().filter((p) => p.state === state);
  }

  /** Check if a plugin is registered. */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /** Get the number of registered plugins. */
  get size(): number {
    return this.plugins.size;
  }

  // ── Dependency Helpers ─────────────────────────────────────────────

  /**
   * Get IDs of plugins that list the given plugin as a dependency.
   */
  private getDependentsOf(pluginId: string): string[] {
    const dependents: string[] = [];
    for (const [, instance] of this.plugins) {
      if (
        instance.config.dependencies?.some((d) => d.pluginId === pluginId)
      ) {
        dependents.push(instance.config.id);
      }
    }
    return dependents;
  }

  /**
   * Return plugin IDs sorted by dependency order (dependencies first).
   */
  private getDependencySorted(): string[] {
    // Gather all registered plugins that have dependency info
    const configs = new Map<string, PluginConfig>();
    for (const [id, instance] of this.plugins) {
      configs.set(id, instance.config);
    }
    try {
      return topologicalSort(configs);
    } catch {
      // If there's a cycle or other issue, return insertion order
      return Array.from(this.plugins.keys());
    }
  }

  // ── Internal Helpers ───────────────────────────────────────────────

  private async applyPluginToClient(
    plugin: PluginInstance,
    client: StellarClient,
  ): Promise<void> {
    try {
      if (plugin.config.hooks?.afterClientInit) {
        await plugin.config.hooks.afterClientInit(client);
      }
    } catch (err) {
      this.setPluginError(plugin, err as Error);
    }

    if (plugin.config.middleware) {
      for (const mw of plugin.config.middleware) {
        client.use(mw);
      }
    }
  }

  private setPluginError(instance: PluginInstance, error: Error): void {
    instance.state = PluginLifecycleState.Error;
    instance.lastError = error;

    // Fire onError hook if defined, but don't throw
    if (instance.config.hooks?.onError) {
      Promise.resolve(instance.config.hooks.onError(error)).catch(() => {
        // Silently ignore errors in the error handler itself
      });
    }
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────

let defaultPluginManager: PluginManager | undefined;

/**
 * Get the default plugin manager instance
 */
export function getPluginManager(): PluginManager {
  if (!defaultPluginManager) {
    defaultPluginManager = new PluginManager();
  }
  return defaultPluginManager;
}

/**
 * Set the default plugin manager instance
 */
export function setPluginManager(manager: PluginManager): void {
  defaultPluginManager = manager;
}
