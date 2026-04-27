import {
  Account,
  Address,
  FeeBumpTransaction,
  Keypair,
  Networks,
  TransactionBuilder
} from "@stellar/stellar-sdk";
import {
  buildContractCallOperation,
  buildContractCallTransaction,
  bumpTransactionFee,
  toScVal
} from "../src/utils/transactionBuilder";

describe("transactionBuilder utils", () => {
  const account = new Account(Keypair.random().publicKey(), "1");

  test("toScVal handles address, number, bigint, boolean, null, and string values", () => {
    const keypair = Keypair.random();
    const address = Address.fromString(keypair.publicKey());

    const addressSc = toScVal(address);
    const numSc = toScVal(123);
    const bigintSc = toScVal(123n);
    const boolSc = toScVal(true);
    const voidSc = toScVal(null);
    const stringSc = toScVal("hello");

    expect(addressSc).toBeTruthy();
    expect(numSc).toBeTruthy();
    expect(bigintSc).toBeTruthy();
    expect(boolSc).toBeTruthy();
    expect(voidSc.switch()).toBe("void");
    expect(stringSc).toBeTruthy();
  });

  test("buildContractCallOperation creates a valid operation for a contract call", () => {
    const contractId = "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef";
    const op = buildContractCallOperation({ contractId, method: "deposit", args: [1, "foo"] });

    expect(op).toBeDefined();
    expect(op.body().switch()).toBe("invokeHostFunction");
  });

  test("buildContractCallTransaction creates a transaction with defaults and timeout", () => {
    const tx = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      method: "deposit",
      args: [1],
      fee: 123456,
      timeoutInSeconds: 120
    });

    expect(tx.fee).toBe("123456");
    expect(tx.timeBounds).toBeDefined();
    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].body().switch()).toBe("invokeHostFunction");
  });

  test("buildContractCallTransaction uses default fee when not provided", () => {
    const tx = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      method: "withdraw"
    });

    expect(tx.fee).toBe("100000");
  });

  test("buildContractCallTransaction uses default timeout when not provided", () => {
    const txBefore = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      method: "balance"
    }).timeBounds;

    expect(txBefore).toBeDefined();
    expect(txBefore!.maxTime).toBeGreaterThan(txBefore!.minTime);
  });

  test("buildContractCallTransaction with no args works correctly", () => {
    const tx = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      method: "claim_rewards"
    });

    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].body().switch()).toBe("invokeHostFunction");
  });

  test("bumpTransactionFee wraps a signed transaction in an unsigned fee bump envelope", () => {
    const source = Keypair.random();
    const sponsor = Keypair.random();
    const innerTx = buildContractCallTransaction({
      sourceAccount: new Account(source.publicKey(), "1"),
      networkPassphrase: Networks.TESTNET,
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      method: "deposit",
      args: [1]
    });

    innerTx.sign(source);

    const feeBumpXdr = bumpTransactionFee(innerTx.toXDR(), 200, {
      feeSource: sponsor.publicKey(),
      networkPassphrase: Networks.TESTNET
    });

    const parsed = TransactionBuilder.fromXDR(feeBumpXdr, Networks.TESTNET);
    expect(parsed).toBeInstanceOf(FeeBumpTransaction);

    const feeBumpTx = parsed as FeeBumpTransaction;
    expect(feeBumpTx.feeSource).toBe(sponsor.publicKey());
    expect(feeBumpTx.signatures).toHaveLength(0);
    expect(feeBumpTx.innerTransaction.signatures).toHaveLength(1);
    expect(feeBumpTx.innerTransaction.toXDR()).toBe(innerTx.toXDR());
  });

  test("bumpTransactionFee rejects unsigned inner transactions", () => {
    const sponsor = Keypair.random();
    const innerTx = buildContractCallTransaction({
      sourceAccount: new Account(Keypair.random().publicKey(), "1"),
      networkPassphrase: Networks.TESTNET,
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef",
      method: "deposit",
      args: [1]
    });

    expect(() =>
      bumpTransactionFee(innerTx.toXDR(), 200, {
        feeSource: sponsor.publicKey(),
        networkPassphrase: Networks.TESTNET
      })
    ).toThrow("signedXdr must include at least one signature");
  });
});
