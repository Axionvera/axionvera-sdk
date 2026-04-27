import { StellarClient } from '../client/stellarClient';
import { WalletConnector } from '../wallet/walletConnector';
import { Address, scValToNative, xdr } from '@stellar/stellar-sdk';
import { AxionveraError } from '../errors/axionveraError';

/**
 * Configuration options for the VaultContract.
 */
export interface VaultContractOptions {
  client: StellarClient;
  contractId: string;
  wallet?: WalletConnector;
  /**
   * Optional: allows overriding the default contract method names if the deployed contract
   * uses different names for querying shares or exchange rate.
   */
  methodNames?: {
    getVaultShares?: string;
    getExchangeRate?: string;
  };
}

/**
 * High-level API for interacting with Axionvera Vault contracts on Soroban.
 *
 * This class provides methods to query read-only state values like
 * user's vault shares and the current exchange rate, as well as
 * methods for deposit, withdraw, etc. (to be implemented).
 *
 * It handles the full transaction lifecycle for write operations
 * (building, simulating, signing, and submitting) and uses read-only
 * simulations for queries to avoid wallet prompts.
 *
 * @example
 * ```typescript
 * import { StellarClient, VaultContract, LocalKeypairWalletConnector } from "axionvera-sdk";
 * import { Keypair } from "@stellar/stellar-sdk";
 *
 * const client = new StellarClient({ network: "testnet" });
 * const wallet = new LocalKeypairWalletConnector(Keypair.fromSecret("..."));
 * const vault = new VaultContract({
 *   client,
 *   contractId: "CONTRACT_ID...",
 *   wallet
 * });
 *
 * // Query user's vault shares
 * const shares = await vault.getVaultShares({ account: "GB..." });
 * console.log("Vault Shares:", shares);
 *
 * // Query the current exchange rate
 * const rate = await vault.getExchangeRate();
 * console.log("Exchange Rate (1 share to underlying):", rate);
 *
 * // Example of a write operation (requires wallet)
 * // await vault.deposit({ amount: 1000n });
 * ```
 */
export class VaultContract {
  readonly contractId: string;
  private readonly client: StellarClient;
  private readonly wallet?: WalletConnector;
  private readonly methodNames: Required<VaultContractOptions['methodNames']>;

  /**
   * Creates a new VaultContract instance.
   * @param options - Configuration options
   */
  constructor(options: VaultContractOptions) {
    this.client = options.client;
    this.contractId = options.contractId;
    this.wallet = options.wallet;
    this.methodNames = {
      getVaultShares: options.methodNames?.getVaultShares || 'get_shares',
      getExchangeRate: options.methodNames?.getExchangeRate || 'get_exchange_rate',
    };
  }

  /**
   * Queries the user's balance of the Vault's specific share token.
   *
   * This method executes a read-only simulation on the network and does NOT
   * require a wallet signature or transaction fee.
   *
   * @param params - Query parameters
   * @param params.account - The account to query (defaults to wallet public key if available)
   * @returns The share balance as a string to prevent precision loss on large integers
   * @throws {AxionveraError} If no account is provided and no wallet is configured.
   */
  async getVaultShares(params: { account?: string } = {}): Promise<string> {
    let accountAddress = params.account;

    if (!accountAddress) {
      if (this.wallet) {
        accountAddress = await this.wallet.getPublicKey();
      } else {
        throw new AxionveraError("Account address is required to query vault shares, or a wallet must be configured.");
      }
    }

    const result = await this.client.simulateRead(
      this.contractId,
      this.methodNames.getVaultShares,
      [new Address(accountAddress).toScVal()] // Pass account as ScVal Address
    );

    // Securely parse scVal to native type and convert to string to prevent precision loss
    const native = scValToNative(result);
    return typeof native === 'bigint' ? native.toString() : String(native);
  }

  /**
   * Queries the contract for the current conversion rate between 1 Share and the underlying asset.
   *
   * This method executes a read-only simulation on the network and does NOT
   * require a wallet signature or transaction fee.
   *
   * @returns The exchange rate as a string to maintain precision for fractional values.
   */
  async getExchangeRate(): Promise<string> {
    const result = await this.client.simulateRead(
      this.contractId,
      this.methodNames.getExchangeRate,
      []
    );

    // Parse result to string to ensure safe handling of high-precision integers/fixed-point values
    const native = scValToNative(result);
    return typeof native === 'bigint' ? native.toString() : String(native);
  }

  // Placeholder for other VaultContract methods (deposit, withdraw, etc.)
  // These would typically involve building, simulating, signing, and submitting transactions.
  // For example:
  // async deposit(params: { amount: bigint; from?: string }): Promise<string> {
  //   const sourceAccount = params.from || (this.wallet ? await this.wallet.getPublicKey() : undefined);
  //   if (!sourceAccount) {
  //     throw new AxionveraError("Source account is required for deposit.");
  //   }
  //   // ... build transaction, simulate, sign, send, poll ...
  //   return "txHash";
  // }
}