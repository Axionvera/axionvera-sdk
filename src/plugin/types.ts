import type { StellarClient, StellarClientOptions } from '../client';
import type { ServiceOverrides } from '../core';
import type { Middleware } from '../middleware';

// ─── Semantic Versioning ───────────────────────────────────────────────

/**
 * Parsed semantic version.
 */
export interface SemVer {
  major: number;
  minor: number;
  patch: number;
  preRelease?: string;
  buildMetadata?: string;
}

// ─── Plugin Lifecycle State ────────────────────────────────────────────

/**
 * Finite state machine for a plugin's lifecycle.
 *
 * ```
 * Unregistered → Registered → Installed → Active
 *                  ↑  ↓           ↓  ↑       ↓
 *                  └──┘       Disabled  ←───┘
 *                                 ↓
 *                             Uninstalled
 * ```
 */
export enum PluginLifecycleState {
  /** Not yet registered with the manager */
  Unregistered = 'unregistered',
  /** Registered but not yet installed */
  Registered = 'registered',
  /** Installed (dependencies resolved, hooks wired) but not active */
  Installed = 'installed',
  /** Fully active — hooks are executing */
  Active = 'active',
  /** Temporarily disabled (hooks paused) */
  Disabled = 'disabled',
  /** Plugin has errors and cannot operate */
  Error = 'error',
  /** Plugin has been removed from the system */
  Uninstalled = 'uninstalled',
}

// ─── Plugin Compatibility ──────────────────────────────────────────────

/**
 * Describes which SDK versions a plugin is compatible with.
 */
export interface PluginCompatibility {
  /** Minimum SDK version (inclusive) */
  minSDKVersion?: string;
  /** Maximum SDK version (inclusive) */
  maxSDKVersion?: string;
  /** Specific SDK versions this plugin was tested against */
  testedSDKVersions?: string[];
  /** Target environment hints */
  environments?: ('node' | 'browser' | 'react-native')[];
}

// ─── Plugin Dependencies ───────────────────────────────────────────────

/**
 * A dependency on another plugin.
 */
export interface PluginDependency {
  /** Plugin ID this plugin depends on */
  pluginId: string;
  /** Minimum required version (semver range) */
  minVersion?: string;
  /** Whether this dependency is optional */
  optional?: boolean;
}

// ─── Plugin Validation ─────────────────────────────────────────────────

/**
 * Result of validating a plugin configuration.
 */
export interface PluginValidationResult {
  /** Whether the plugin passed all validation checks */
  valid: boolean;
  /** Human-readable list of issues */
  errors: string[];
  /** Non-blocking warnings */
  warnings: string[];
}

// ─── Plugin Manifest ───────────────────────────────────────────────────

/**
 * External manifest that a third-party developer provides to declare a plugin.
 * This is the "public API" for plugin authors.
 */
export interface PluginManifest {
  /** Globally unique plugin identifier (reverse-domain recommended) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Semver version string (e.g. "1.2.3") */
  version: string;
  /** Short description */
  description?: string;
  /** Author / organisation */
  author?: string;
  /** URL to homepage or repository */
  homepage?: string;
  /** License identifier (SPDX) */
  license?: string;
  /** SDK compatibility constraints */
  compatibility: PluginCompatibility;
  /** Other plugins this plugin depends on */
  dependencies?: PluginDependency[];
  /** Keywords for discovery */
  keywords?: string[];
}

// ─── Plugin Hooks ──────────────────────────────────────────────────────

/**
 * Rich lifecycle hooks that a plugin may implement.
 * Every hook is optional — only implement what you need.
 */
export interface PluginHooks {
  // ── Lifecycle ──
  /** Called when the plugin is first registered with the manager */
  onRegister?: () => void | Promise<void>;
  /** Called when the plugin is installed (dependencies resolved) */
  onInstall?: () => void | Promise<void>;
  /** Called when the plugin becomes active */
  onEnable?: () => void | Promise<void>;
  /** Called when the plugin is temporarily disabled */
  onDisable?: () => void | Promise<void>;
  /** Called when the plugin is uninstalled */
  onUninstall?: () => void | Promise<void>;

  // ── Client integration ──
  /** Called before the StellarClient is initialized. May mutate options. */
  beforeClientInit?: (
    options: StellarClientOptions,
  ) => StellarClientOptions | Promise<StellarClientOptions>;
  /** Called after the StellarClient is initialized. */
  afterClientInit?: (client: StellarClient) => void | Promise<void>;

  // ── Error handling ──
  /** Called when the plugin encounters an error */
  onError?: (error: Error) => void | Promise<void>;
}

// ─── Plugin Configuration ──────────────────────────────────────────────

/**
 * Full plugin configuration used internally by the PluginManager.
 * Combines the manifest with runtime hooks, services, and middleware.
 */
export interface PluginConfig extends PluginManifest {
  /** Lifecycle hooks */
  hooks?: PluginHooks;
  /** Service overrides for dependency injection */
  services?: ServiceOverrides;
  /** Middleware to register */
  middleware?: Middleware[];
}

// ─── Plugin Instance ───────────────────────────────────────────────────

/**
 * Runtime instance of a plugin tracked by the PluginManager.
 */
export interface PluginInstance {
  /** The plugin's configuration */
  config: PluginConfig;
  /** Current lifecycle state */
  state: PluginLifecycleState;
  /** Timestamp when the plugin was registered */
  registeredAt?: Date;
  /** Timestamp when the plugin was installed */
  installedAt?: Date;
  /** Last validation result (if any) */
  lastValidation?: PluginValidationResult;
  /** Last error that occurred (if state is Error) */
  lastError?: Error;
}

// ─── Plugin Manager Configuration ──────────────────────────────────────

/**
 * Configuration for the PluginManager itself.
 */
export interface PluginManagerConfig {
  /** Auto-install plugins when registered */
  autoInstall?: boolean;
  /** Auto-enable plugins after install */
  autoEnable?: boolean;
  /** Whether to validate plugins on registration */
  validateOnRegister?: boolean;
  /** SDK version string (used for compatibility checks) */
  sdkVersion?: string;
  /** Allow plugins marked as incompatible (with warning) */
  allowIncompatible?: boolean;
}

// ─── Plugin Registry ───────────────────────────────────────────────────

/**
 * A registry that holds all known plugin manifests (even unregistered ones).
 * Used for dependency resolution and discovery.
 */
export interface PluginRegistryEntry {
  manifest: PluginManifest;
  /** Path or module specifier used to load the plugin */
  source: string;
  /** Whether this entry is currently loaded */
  loaded: boolean;
}

// ─── Utility types ─────────────────────────────────────────────────────

/**
 * Plugin factory function — the standard way to define a plugin in code.
 */
export type PluginFactory = (
  options?: Record<string, unknown>,
) => PluginConfig | Promise<PluginConfig>;
