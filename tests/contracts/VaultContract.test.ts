import { Keypair, StrKey, nativeToScVal, xdr } from '@stellar/stellar-sdk';

import { VaultContract } from '../../packages/core/src/contracts/VaultContract';
import { StellarClient } from '../../packages/core/src/client/stellarClient';
import { WalletConnector } from '../../packages/core/src/wallet/walletConnector';

function buildSuccessSimulation(retvalBigint: bigint) {
  return {
    _parsed: true,
    result: {
      retval: nativeToScVal(retvalBigint, { type: 'i128' }),
      auth: [] as xdr.SorobanAuthorizationEntry[],
    },
  };
}

describe('VaultContract preview methods', () => {
  let client: StellarClient;
  let wallet: WalletConnector;
  const contractId = StrKey.encodeContract(Buffer.alloc(32));

  beforeEach(() => {
    client = new StellarClient({ network: 'testnet' });
    wallet = {
      getPublicKey: jest.fn().mockResolvedValue(Keypair.random().publicKey()),
      signTransaction: jest.fn().mockResolvedValue('signed-xdr'),
    } as unknown as WalletConnector;
  });

  test('previewDeposit returns the simulated shares as bigint', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    jest
      .spyOn(client, 'simulateTransaction')
      .mockResolvedValue(buildSuccessSimulation(1234n) as any);

    await expect(vault.previewDeposit(1000n)).resolves.toBe(1234n);
  });

  test('previewWithdraw returns the simulated assets as bigint', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    jest
      .spyOn(client, 'simulateTransaction')
      .mockResolvedValue(buildSuccessSimulation(987n) as any);

    await expect(vault.previewWithdraw(500n)).resolves.toBe(987n);
  });

  test('previewDeposit propagates a simulation failure as an error', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    jest.spyOn(client, 'simulateTransaction').mockResolvedValue({
      _parsed: true,
      error: 'host function trapped',
    } as any);

    await expect(vault.previewDeposit(1000n)).rejects.toThrow(/preview_deposit/);
  });

  test('previewWithdraw propagates a simulation failure as an error', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    jest.spyOn(client, 'simulateTransaction').mockResolvedValue({
      _parsed: true,
      error: 'host function trapped',
    } as any);

    await expect(vault.previewWithdraw(500n)).rejects.toThrow(/preview_withdraw/);
  });

  test('preview methods never invoke the wallet connector', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    jest
      .spyOn(client, 'simulateTransaction')
      .mockResolvedValue(buildSuccessSimulation(42n) as any);

    await vault.previewDeposit(100n);
    await vault.previewWithdraw(50n);

    expect(wallet.getPublicKey).not.toHaveBeenCalled();
    expect(wallet.signTransaction).not.toHaveBeenCalled();
  });

  test('preview methods do not call rpc.getAccount (no on-chain account required)', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    const getAccountSpy = jest.spyOn(client.rpc, 'getAccount');
    jest
      .spyOn(client, 'simulateTransaction')
      .mockResolvedValue(buildSuccessSimulation(42n) as any);

    await vault.previewDeposit(100n);
    await vault.previewWithdraw(50n);

    expect(getAccountSpy).not.toHaveBeenCalled();
  });
});
