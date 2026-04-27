import { Keypair, StrKey } from '@stellar/stellar-sdk';

import { VaultContract } from '../packages/core/src/contracts/VaultContract';
import { StellarClient } from '../packages/core/src/client/stellarClient';
import { SlippageToleranceExceededError } from '../packages/core/src/errors/axionveraError';
import { WalletConnector } from '../packages/core/src/wallet/walletConnector';

describe('VaultContract slippage protection', () => {
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

  test('deposit with no slippage param remains backward-compatible', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    const buildAndSignSpy = jest
      .spyOn((vault as any).transactionSigner, 'buildAndSignTransaction')
      .mockResolvedValue({ hash: 'abc', status: 'SUCCESS', successful: true, raw: {}, signedXdr: 'x' });
    const simulateSpy = jest.spyOn(vault as any, 'simulateI128Result');

    const result = await vault.deposit({ amount: 1000n });

    expect(buildAndSignSpy).toHaveBeenCalledTimes(1);
    expect(simulateSpy).not.toHaveBeenCalled();
    expect(result).toEqual(expect.objectContaining({ hash: 'abc' }));
  });

  test('deposit proceeds when simulated shares satisfy minSharesOut', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    const buildAndSignSpy = jest
      .spyOn((vault as any).transactionSigner, 'buildAndSignTransaction')
      .mockResolvedValue({ hash: 'abc', status: 'SUCCESS', successful: true, raw: {}, signedXdr: 'x' });
    jest.spyOn(vault as any, 'simulateI128Result').mockResolvedValue(1000n);

    await expect(
      vault.deposit({ amount: 1000n, minSharesOut: 900n })
    ).resolves.toEqual(expect.objectContaining({ hash: 'abc' }));
    expect(buildAndSignSpy).toHaveBeenCalledTimes(1);
  });

  test('deposit throws SlippageToleranceExceededError when simulated shares fall short', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    const buildAndSignSpy = jest.spyOn(
      (vault as any).transactionSigner,
      'buildAndSignTransaction'
    );
    jest.spyOn(vault as any, 'simulateI128Result').mockResolvedValue(800n);

    await expect(
      vault.deposit({ amount: 1000n, minSharesOut: 900n })
    ).rejects.toBeInstanceOf(SlippageToleranceExceededError);
    expect(buildAndSignSpy).not.toHaveBeenCalled();
  });

  test('withdraw throws SlippageToleranceExceededError when simulated assets-in exceeds maxAssetsIn', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    const buildAndSignSpy = jest.spyOn(
      (vault as any).transactionSigner,
      'buildAndSignTransaction'
    );
    jest.spyOn(vault as any, 'simulateI128Result').mockResolvedValue(1100n);

    await expect(
      vault.withdraw({ amount: 1000n, maxAssetsIn: 1050n })
    ).rejects.toBeInstanceOf(SlippageToleranceExceededError);
    expect(buildAndSignSpy).not.toHaveBeenCalled();
  });

  test('thrown SlippageToleranceExceededError carries expected, actual, and tolerance', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    jest.spyOn((vault as any).transactionSigner, 'buildAndSignTransaction');
    jest.spyOn(vault as any, 'simulateI128Result').mockResolvedValue(800n);

    await expect(vault.deposit({ amount: 1000n, minSharesOut: 900n })).rejects.toMatchObject({
      name: 'SlippageToleranceExceededError',
      expected: 900n,
      actual: 800n,
      tolerance: 900n,
    });
  });

  test('deposit with txBuilder skips slippage simulation', async () => {
    const vault = new VaultContract({ client, contractId, wallet });
    const simulateSpy = jest.spyOn(vault as any, 'simulateI128Result');
    const builder = { addOperation: jest.fn().mockReturnThis() } as any;

    const returned = await vault.deposit({ amount: 1000n, minSharesOut: 900n, txBuilder: builder });

    expect(simulateSpy).not.toHaveBeenCalled();
    expect(builder.addOperation).toHaveBeenCalledTimes(1);
    expect(returned).toBe(builder);
  });
});
