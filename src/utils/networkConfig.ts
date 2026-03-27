import { Networks } from "@stellar/stellar-sdk";

/**
 * Supported Axionvera networks.
 */
export type AxionveraNetwork = "testnet" | "mainnet";

/**
 * Configuration for network connections.
 */
export type NetworkConfig = {
  /** The network identifier */
  network: AxionveraNetwork;
  /** The RPC URL for the network */
  rpcUrl: string;
  /** The network passphrase for transaction signing */
  networkPassphrase: string;
};

const DEFAULT_RPC_URLS: Record<AxionveraNetwork, string> = {
  testnet: "https://soroban-testnet.stellar.org",
  mainnet: "https://soroban-mainnet.stellar.org"
};

/**
 * Gets the network passphrase for a given network.
 * @param network - The network identifier
 * @returns The network passphrase
 */
export function getNetworkPassphrase(network: AxionveraNetwork): string {
  switch (network) {
    case "testnet":
      return Networks.TESTNET;
    case "mainnet":
      return Networks.PUBLIC;
  }
}

/**
 * Gets the default RPC URL for a given network.
 * @param network - The network identifier
 * @returns The default RPC URL
 */
export function getDefaultRpcUrl(network: AxionveraNetwork): string {
  return DEFAULT_RPC_URLS[network];
}

/**
 * Resolves network configuration from input options.
 * Fills in defaults for any missing values.
 * @param input - Optional network configuration overrides
 * @returns The resolved network configuration
 */
export function resolveNetworkConfig(input?: {
  network?: AxionveraNetwork;
  rpcUrl?: string;
  networkPassphrase?: string;
}): NetworkConfig {
  const network = input?.network ?? "testnet";
  const networkPassphrase =
    input?.networkPassphrase ?? getNetworkPassphrase(network);
  const rpcUrl = input?.rpcUrl ?? getDefaultRpcUrl(network);

  return { network, rpcUrl, networkPassphrase };
}
