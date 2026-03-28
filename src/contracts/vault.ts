import {
  Address,
  FeeBumpTransaction,
  Transaction,
  TransactionBuilder,
  scValToNative,
  xdr
} from "@stellar/stellar-sdk";

import { StellarClient } from "../client/stellarClient";
import { ValidationError, toAxionveraError } from "../errors/axionveraError";
import { WalletConnector } from "../wallet/walletConnector";
import { buildContractCallTransaction, toScVal } from "../utils/transactionBuilder";

export type VaultContractMethodNames = {
  deposit: string;
  withdraw: string;
  balance: string;
  claimRewards: string;
};

export type VaultContractOptions = {
  methods?: Partial<VaultContractMethodNames>;
};

/**
 * High-level API for interacting with Axionvera Vault contracts.
 *
 * Handles the full transaction lifecycle: building, simulating,
 * signing, and submitting transactions to the vault contract.
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
 * await vault.deposit({ amount: 1000n });
 * ```
 */
export class VaultContract {
  /** The deployed vault contract ID on the network. */
  readonly contractId: string;
  private readonly client: StellarClient;
  private readonly wallet?: WalletConnector;
  private readonly methods: VaultContractMethodNames;

  /**
   * Creates a new VaultContract instance.
   * @param params - Constructor parameters
   * @param params.client - The StellarClient instance for RPC communication
   * @param params.contractId - The deployed vault contract ID
   * @param params.wallet - Optional wallet connector for signing transactions
   * @param params.options - Optional configuration for method names
   */
  constructor(params: {
    client: StellarClient;
    contractId: string;
    wallet?: WalletConnector;
    options?: VaultContractOptions;
  }) {
    this.client = params.client;
    this.contractId = params.contractId;
    this.wallet = params.wallet;
    this.methods = {
      deposit: "deposit",
      withdraw: "withdraw",
      balance: "balance",
      claimRewards: "claim_rewards",
      ...params.options?.methods
    };
  }

  /**
   * Deposits assets into the vault.
   * @param params - Deposit parameters
   * @param params.amount - The amount to deposit
   * @param params.from - The source account (defaults to wallet public key)
   * @returns The transaction result
   */
  async deposit(params: { amount: bigint; from?: string }): Promise<unknown> {
    return this.sendContractCall({
      source: params.from,
      method: this.methods.deposit,
      args: [
        Address.fromString(await this.getSourcePublicKey(params.from)).toScVal(),
        toScVal(params.amount)
      ]
    });
  }

  /**
   * Withdraws assets from the vault.
   * @param params - Withdraw parameters
   * @param params.amount - The amount to withdraw
   * @param params.from - The source account (defaults to wallet public key)
   * @returns The transaction result
   */
  async withdraw(params: { amount: bigint; from?: string }): Promise<unknown> {
    return this.sendContractCall({
      source: params.from,
      method: this.methods.withdraw,
      args: [
        Address.fromString(await this.getSourcePublicKey(params.from)).toScVal(),
        toScVal(params.amount)
      ]
    });
  }

  /**
   * Claims accumulated rewards from the vault.
   * @param params - Optional parameters
   * @param params.from - The source account (defaults to wallet public key)
   * @returns The transaction result
   */
  async claimRewards(params?: { from?: string }): Promise<unknown> {
    return this.sendContractCall({
      source: params?.from,
      method: this.methods.claimRewards,
      args: [Address.fromString(await this.getSourcePublicKey(params?.from)).toScVal()]
    });
  }

  /**
   * Gets the balance of an account in the vault.
   * @param params - Query parameters
   * @param params.account - The account to query (defaults to wallet public key)
   * @returns The account balance
   */
  async getBalance(params: { account?: string }): Promise<unknown> {
    return this.executeWithErrorHandling(async () => {
      const publicKey = params.account ?? (this.wallet ? await this.wallet.getPublicKey() : undefined);
      if (!publicKey) {
        throw new ValidationError("account is required when no wallet connector is provided");
      }

      const sourceAccount = await this.client.getAccount(publicKey);
      const tx = buildContractCallTransaction({
        sourceAccount,
        networkPassphrase: this.client.networkPassphrase,
        contractId: this.contractId,
        method: this.methods.balance,
        args: [Address.fromString(publicKey)]
      });

      const sim = await this.client.simulateTransaction(tx);
      if (!isSimSuccess(sim)) {
        throw new ValidationError("Simulation failed");
      }

      const retval = (sim as any).result?.retval as xdr.ScVal | undefined;
      return retval ? scValToNative(retval) : null;
    }, "Failed to retrieve vault balance");
  }

  private async getSourcePublicKey(source?: string): Promise<string> {
    if (source) return source;
    if (!this.wallet) {
      throw new ValidationError("wallet connector is required for signing transactions");
    }
    return this.wallet.getPublicKey();
  }

  private async sendContractCall(params: {
    source?: string;
    method: string;
    args?: Array<xdr.ScVal>;
  }): Promise<unknown> {
    if (!this.wallet) {
      throw new ValidationError("wallet connector is required for signing transactions");
    }
    const wallet = this.wallet;

    return this.executeWithErrorHandling(async () => {
      const publicKey = await this.getSourcePublicKey(params.source);
      const sourceAccount = await this.client.getAccount(publicKey);

      const tx = buildContractCallTransaction({
        sourceAccount,
        networkPassphrase: this.client.networkPassphrase,
        contractId: this.contractId,
        method: params.method,
        args: params.args ?? []
      });

      const sim = await this.client.simulateTransaction(tx);
      if (!isSimSuccess(sim)) {
        throw new ValidationError("Simulation failed");
      }

      const prepared = await this.client.prepareTransaction(tx);
      const signedXdr = await wallet.signTransaction(
        prepared.toXDR(),
        this.client.networkPassphrase
      );
      const signedTx = TransactionBuilder.fromXDR(
        signedXdr,
        this.client.networkPassphrase
      ) as Transaction | FeeBumpTransaction;

      return this.client.sendTransaction(signedTx);
    }, `Failed to execute vault method ${params.method}`);
  }

  private async executeWithErrorHandling<T>(fn: () => Promise<T>, fallbackMessage: string): Promise<T> {
    try {
      return await fn();
    } catch (error: unknown) {
      throw toAxionveraError(error, fallbackMessage);
    }
  }
}

function isSimSuccess(sim: unknown): boolean {
  return Boolean(sim) && !(sim as any).error && Boolean((sim as any).result);
}
