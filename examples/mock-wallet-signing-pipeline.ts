/**
 * Example: provider-generic transaction signing pipeline with MockWalletConnector.
 *
 * This example keeps transaction preparation separate from wallet signing and
 * does not require a real wallet extension.
 */

import {
  MockWalletConnector,
  createTransactionSigningPipeline,
  type UnsignedTransactionSigningRequestInput,
} from '../packages/core/src';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';

interface DepositPreparationInput {
  amount: bigint;
  sourceAccount: string;
}

async function prepareUnsignedDepositXdr(
  input: DepositPreparationInput
): Promise<UnsignedTransactionSigningRequestInput> {
  // In a real app this function would build and simulate a Stellar/Soroban
  // transaction, then return transaction.toXDR() before any wallet signature.
  const mockedUnsignedXdr = Buffer.from(`deposit:${input.sourceAccount}:${input.amount}`).toString('base64');

  return {
    unsignedXdr: mockedUnsignedXdr,
    networkPassphrase: TESTNET_PASSPHRASE,
    accountToSign: input.sourceAccount,
    metadata: {
      action: 'deposit',
      amount: input.amount.toString(),
    },
  };
}

async function runExample() {
  const wallet = new MockWalletConnector('GAXIONVERAMOCKPUBLICKEY');
  await wallet.connect();

  const signingPipeline = createTransactionSigningPipeline({
    wallet,
    prepareUnsignedTransaction: prepareUnsignedDepositXdr,
  });

  const result = await signingPipeline.prepareAndSign({
    amount: 100n,
    sourceAccount: 'GAXIONVERAMOCKPUBLICKEY',
  });

  console.log({
    unsignedXdr: result.unsignedXdr,
    signedXdr: result.signedXdr,
    walletId: result.walletId,
    metadata: result.metadata,
  });
}

void runExample();
