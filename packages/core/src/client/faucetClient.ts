import { StellarClient } from "./stellarClient";
import { FaucetRateLimitError, AxionveraError } from "../errors/axionveraError";
import axios from "axios";

/**
 * Client for interacting with Stellar Friendbot faucets.
 * Useful for automated account funding on Testnet and Futurenet.
 */
export class FaucetClient {
  /**
   * Creates a new FaucetClient.
   * @param client - An instance of StellarClient to detect the current network.
   */
  constructor(private client: StellarClient) {}

  /**
   * Funds an account using Friendbot.
   * 
   * @param publicKey - The public key of the account to fund.
   * @throws {AxionveraError} If executed on Mainnet or if the network is unsupported.
   * @throws {FaucetRateLimitError} If Friendbot rejects the request due to rate limiting (HTTP 429).
   */
  async fundAccount(publicKey: string): Promise<void> {
    const network = this.client.network;

    if (network === "mainnet") {
      throw new AxionveraError("Friendbot is not available on Mainnet. Please use a funded account or a manual bridge.");
    }

    let url: string;
    if (network === "testnet") {
      url = `https://friendbot.stellar.org/?addr=${publicKey}`;
    } else if (network === "futurenet") {
      url = `https://friendbot-futurenet.stellar.org/?addr=${publicKey}`;
    } else {
      throw new AxionveraError(`Unsupported network for Friendbot: ${network}`);
    }

    try {
      await axios.get(url);
    } catch (error: any) {
      if (error.response && error.response.status === 429) {
        throw new FaucetRateLimitError("Friendbot rate limit exceeded. Please try again later.", {
          statusCode: 429,
          originalError: error
        });
      }
      
      const message = error.response?.data?.detail || error.message;
      throw new AxionveraError(`Failed to fund account: ${message}`, {
        originalError: error,
        statusCode: error.response?.status
      });
    }
  }
}
