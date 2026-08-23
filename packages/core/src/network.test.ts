import { describe, it, expect } from 'vitest';
import { resolveNetworkConfig } from './network';

describe('resolveNetworkConfig', () => {
  it('resolves to testnet by default when no input is provided', () => {
    const config = resolveNetworkConfig();
    expect(config.network).toBe('testnet');
    expect(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('resolves known network presets correctly', () => {
    const mainnetConfig = resolveNetworkConfig({ network: 'mainnet' });
    expect(mainnetConfig.network).toBe('mainnet');
    expect(mainnetConfig.rpcUrl).toBe('https://soroban-rpc.mainnet.stellar.gateway.fm');
    expect(mainnetConfig.horizonUrl).toBe('https://horizon.stellar.org');
    expect(mainnetConfig.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');

    const futurenetConfig = resolveNetworkConfig({ network: 'futurenet' });
    expect(futurenetConfig.network).toBe('futurenet');
    expect(futurenetConfig.rpcUrl).toBe('https://rpc-futurenet.stellar.org');
    expect(futurenetConfig.horizonUrl).toBe('https://horizon-futurenet.stellar.org');
    expect(futurenetConfig.networkPassphrase).toBe('Test SDF Future Network ; October 2022');
  });

  it('overrides preset RPC URL when custom rpcUrl is provided', () => {
    const customRpc = 'https://custom-rpc.example.com';
    const config = resolveNetworkConfig({ network: 'testnet', rpcUrl: customRpc });
    expect(config.network).toBe('testnet');
    expect(config.rpcUrl).toBe(customRpc);
    expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('overrides preset Horizon URL when custom horizonUrl is provided', () => {
    const customHorizon = 'https://custom-horizon.example.com';
    const config = resolveNetworkConfig({ network: 'testnet', horizonUrl: customHorizon });
    expect(config.network).toBe('testnet');
    expect(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.horizonUrl).toBe(customHorizon);
    expect(config.networkPassphrase).toBe('Test SDF Network ; September 2015');
  });

  it('overrides preset passphrase when custom networkPassphrase is provided', () => {
    const customPassphrase = 'Custom Passphrase ; 2026';
    const config = resolveNetworkConfig({ network: 'testnet', networkPassphrase: customPassphrase });
    expect(config.network).toBe('testnet');
    expect(config.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    expect(config.horizonUrl).toBe('https://horizon-testnet.stellar.org');
    expect(config.networkPassphrase).toBe(customPassphrase);
  });
});
