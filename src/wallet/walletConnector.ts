import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { AxionveraNetwork } from "../utils/networkConfig";
import { assertValidXDR } from '../utils';
import { InvalidXDRError } from '../errors';

/**
 * Interface for wallet implementations that can sign transactions.
 * Implement this interface to integrate browser extension wallets (like Freighter) or use the provided connectors.
 * @example
 * ```typescript
 * import { WalletConnector } from "axionvera-sdk";
 *
 * class CustomWalletConnector implements WalletConnector {
 *   async getPublicKey(): Promise<string> {
 *     // Return the connected wallet's public key
 *     return "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
 *   }
 *
 *   async signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string> {
 *     // Sign the transaction using your wallet
 *     return signedXdr;
 *   }
 * }
 * ```
 */
export interface WalletConnector {
  /**
   * Gets the public key of the connected account.
* @returns A Promise that resolves to the public key of the connected account (G-prefixed string).
   * @example
   * ```typescript
   * const publicKey = await wallet.getPublicKey();
   * console.log("Connected account:", publicKey);
   * ```
   */
  getPublicKey(): Promise<string>;

  /**
   * Gets the network that the wallet is currently connected to.
   * @returns The network identifier
   */
  getNetwork(): Promise<AxionveraNetwork>;

  /**
   * Signs a transaction XDR string.
   * 
   * Must throw a `WalletConnectionError` if the user rejects the signature or if the connection fails.
   * 
   * @param xdr - The base64-encoded transaction XDR to sign
   * @param networkPassphrase - The network passphrase
* Signs a transaction XDR string using the wallet's private key.
   * * Must throw a `WalletConnectionError` if the user rejects the signature or if the connection fails.
   * * @param transactionXdr - The base64-encoded transaction XDR to sign
   * @param networkPassphrase - The network passphrase for the transaction
   * @returns A Promise that resolves to the base64-encoded signed transaction XDR
   * @example
   * ```typescript
   * const signedXdr = await wallet.signTransaction(
   * unsignedXdr,
   * "Test SDF Network ; September 2015"
   * );
   * console.log("Signed transaction:", signedXdr);
   * ```
   */
  signTransaction(xdr: string, networkPassphrase: string): Promise<string>;
}

/**
 * Wallet connector implementation using a local Keypair for server-side or automated signing.
 * Useful for testing, development, and backend services without a browser wallet.
 * @example
 * ```typescript
 * import { LocalKeypairWalletConnector } from "axionvera-sdk";
 * import { Keypair } from "@stellar/stellar-sdk";
 *
 * const keypair = Keypair.fromSecret("S...");
 * const wallet = new LocalKeypairWalletConnector(keypair);
 *
 * const publicKey = await wallet.getPublicKey();
 * console.log("Public key:", publicKey);
 * ```
 */
export class LocalKeypairWalletConnector implements WalletConnector {
  private readonly keypair: Keypair;
  private readonly network: AxionveraNetwork;

  /**
   * Creates a new LocalKeypairWalletConnector with the provided Keypair.
   * @param keypair - The Keypair to use for signing transactions
   * @example
   * ```typescript
   * import { LocalKeypairWalletConnector } from "axionvera-sdk";
   * import { Keypair } from "@stellar/stellar-sdk";
   *
   * // From secret key
   * const keypair = Keypair.fromSecret("S...");
   * const wallet = new LocalKeypairWalletConnector(keypair);
   *
   * // Or generate a new random keypair
   * const randomKeypair = Keypair.random();
   * const randomWallet = new LocalKeypairWalletConnector(randomKeypair);
   * ```
   */
  constructor(keypair: Keypair, network: AxionveraNetwork = "testnet") {
    this.keypair = keypair;
    this.network = network;
  }

  /**
   * Gets the public key from the stored Keypair.
   * @returns The public key as a G-prefixed string
   * @example
   * ```typescript
   * const publicKey = await wallet.getPublicKey();
   * console.log("Public key:", publicKey);
   * ```
   */
  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
  }

  /** @inheritdoc */
  async getNetwork(): Promise<AxionveraNetwork> {
    return this.network;
  }

  /** @inheritdoc */
  /**
   * Signs a transaction using the stored Keypair.
   * @param transactionXdr - The base64-encoded transaction XDR to sign
   * @param networkPassphrase - The network passphrase for the transaction
   * @returns The base64-encoded signed transaction XDR
   * @example
   * ```typescript
   * const signedXdr = await wallet.signTransaction(
   *   unsignedXdr,
   *   "Test SDF Network ; September 2015"
   * );
   * console.log("Signed transaction:", signedXdr);
   * ```
   */
  async signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    // Sanitize before any buffer allocation.
    assertValidXDR(transactionXdr, 'signTransaction');
    try {
      const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
      tx.sign(this.keypair);
      return tx.toXDR();
    } catch (err) {
      throw new InvalidXDRError(
        `signTransaction: failed to parse XDR: ${
          err instanceof Error ? err.message : String(err)
        }`,
        transactionXdr,
        { originalError: err },
      );
    }
  }
}

/**
 * Mock wallet connector for browser sandbox testing.
 * Returns a fake public key and simulates signing without requiring a real wallet.
 * Useful for playground environments and StackBlitz demos.
 * Mock wallet connector for browser sandbox testing and playground environments.
 * Returns a fake public key and simulates signing without requiring a real wallet.
 * Useful for StackBlitz demos, prototyping, and demonstrating SDK flows.
 * @example
 * ```typescript
 * import { MockWalletConnector } from "axionvera-sdk";
 *
 * // Use with auto-generated public key
 * const mockWallet = new MockWalletConnector();
 *
 * // Or use with a specific public key
 * const customMockWallet = new MockWalletConnector(
 *   "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V"
 * );
 *
 * const publicKey = await mockWallet.getPublicKey();
 * console.log("Mock public key:", publicKey);
 * ```
 */
export class MockWalletConnector implements WalletConnector {
  private readonly mockPublicKey: string;
  private readonly network: AxionveraNetwork;

  /**
   * Creates a new MockWalletConnector with an optional fake public key and network.
   * @param publicKey - Optional fake public key. If not provided, generates a random one.
   * @param network - The network this connector operates on (default: "testnet")
   * @example
   * ```typescript
   * import { MockWalletConnector } from "axionvera-sdk";
   *
   * // Auto-generate a random public key
   * const wallet1 = new MockWalletConnector();
   *
   * // Use a specific public key for testing
   * const wallet2 = new MockWalletConnector(
   *   "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V"
   * );
   * ```
   */
  constructor(publicKey?: string, network: AxionveraNetwork = "testnet") {
    this.mockPublicKey = publicKey || Keypair.random().publicKey();
    this.network = network;
  }

  /** @inheritdoc */
  /**
   * Gets the mock public key.
   * @returns The mock public key as a G-prefixed string
   * @example
   * ```typescript
   * const publicKey = await mockWallet.getPublicKey();
   * console.log("Mock public key:", publicKey);
   * ```
   */
  async getPublicKey(): Promise<string> {
    return this.mockPublicKey;
  }

  /**
   * Returns the network this mock connector was configured for.
   * @inheritdoc
   */
  async getNetwork(): Promise<AxionveraNetwork> {
    return this.network;
  }

  /** @inheritdoc */
  /**
   * Simulates signing a transaction by returning the unsigned XDR.
   * Note: This is a mock implementation for testing purposes only.
   * The transaction will fail during actual network submission.
   * @param transactionXdr - The base64-encoded transaction XDR
   * @param networkPassphrase - The network passphrase (unused in mock)
   * @returns The unsigned transaction XDR (simulated signing)
   * @example
   * ```typescript
   * const signedXdr = await mockWallet.signTransaction(
   *   unsignedXdr,
   *   "Test SDF Network ; September 2015"
   * );
   * // Note: This returns the unsigned XDR for simulation purposes
   * console.log("Mock signed transaction:", signedXdr);
   * ```
   */
  async signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    // In a real implementation, this would sign the transaction.
    // For the mock, we just return the unsigned XDR to simulate the flow.
    // The transaction will fail during simulation, but the UI will remain responsive.
    return transactionXdr;
  }
}
