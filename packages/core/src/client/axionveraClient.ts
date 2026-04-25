import { StellarClient, StellarClientOptions } from './stellarClient';
import { VaultContract } from '../contracts/VaultContract';
import { WalletConnector } from '../wallet/walletConnector';

/**
 * Unified configuration for the AxionveraClient.
 */
export type AxionveraClientConfig = StellarClientOptions & {
  /** The wallet connector for signing transactions */
  wallet?: WalletConnector;
  /** The contract ID of the Vault (optional, can be provided later) */
  vaultId?: string;
};

/**
 * The primary entry point for the Axionvera SDK.
 * 
 * AxionveraClient provides a unified interface to all SDK features, 
 * including RPC operations, wallet management, and contract interactions.
 * It uses lazy-loading to ensure that complex objects (like contract wrappers)
 * are only initialized when needed.
 * 
 * @example
 * ```typescript
 * const axionvera = new AxionveraClient({
 *   network: 'testnet',
 *   wallet: myWallet,
 *   vaultId: 'C...'
 * });
 * 
 * // Access RPC methods
 * const health = await axionvera.rpc.getHealth();
 * 
 * // Access Vault contract
 * const balance = await axionvera.vault.getBalance();
 * ```
 */
export class AxionveraClient {
  /** Pre-configured StellarClient for RPC operations */
  public readonly rpc: StellarClient;
  /** Wallet connector for signing operations */
  public readonly wallet: WalletConnector | undefined;
  
  private _vault: VaultContract | null = null;
  private readonly _vaultId: string | undefined;

  /**
   * Creates a new AxionveraClient instance.
   * @param config - Unified configuration object
   */
  constructor(config: AxionveraClientConfig = {}) {
    this.rpc = new StellarClient(config);
    this.wallet = config.wallet;
    this._vaultId = config.vaultId;
  }

  /**
   * Returns a pre-configured VaultContract instance.
   * Lazily initialized on first access.
   * 
   * @throws Error if vaultId or wallet is not configured
   */
  public get vault(): VaultContract {
    if (!this._vault) {
      if (!this._vaultId) {
        throw new Error(
          "Vault ID not configured. Please provide 'vaultId' in AxionveraClient constructor."
        );
      }
      
      if (!this.wallet) {
        throw new Error(
          "Wallet connector not configured. Please provide 'wallet' in AxionveraClient constructor."
        );
      }

      this._vault = new VaultContract({
        client: this.rpc,
        contractId: this._vaultId,
        wallet: this.wallet
      });
    }
    return this._vault;
  }
}
