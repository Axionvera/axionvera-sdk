import { Account, Keypair, Address } from "@stellar/stellar-sdk";
import { buildContractCallOperation, buildContractCallTransaction, toScVal, ContractCallBuilder } from "../src/utils/transactionBuilder";

// Valid Strkey-encoded contract ID for testing
const CONTRACT_ID = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD2KM";

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
    expect(voidSc.switch().name).toBe("scvVoid");
    expect(stringSc).toBeTruthy();
  });

  test("buildContractCallOperation creates a valid operation for a contract call", () => {
    const op = buildContractCallOperation({ contractId: CONTRACT_ID, method: "deposit", args: [1, "foo"] });

    expect(op).toBeDefined();
    expect((op as any)._attributes).toBeDefined();
  });

  test("buildContractCallTransaction creates a transaction with defaults and timeout", () => {
    const tx = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: CONTRACT_ID,
      method: "deposit",
      args: [1],
      fee: 123456,
      timeoutInSeconds: 120
    });

    expect(tx.fee).toBe("123456");
    expect(tx.timeBounds).toBeDefined();
    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].type).toBe("invokeHostFunction");
  });

  test("buildContractCallTransaction uses default fee when not provided", () => {
    const tx = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: CONTRACT_ID,
      method: "withdraw"
    });

    expect(tx.fee).toBe("100000");
  });

  test("buildContractCallTransaction uses default timeout when not provided", () => {
    const txBefore = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: CONTRACT_ID,
      method: "balance"
    }).timeBounds;

    expect(txBefore).toBeDefined();
    expect(Number(txBefore!.maxTime)).toBeGreaterThan(Number(txBefore!.minTime));
  });

  test("buildContractCallTransaction with no args works correctly", () => {
    const tx = buildContractCallTransaction({
      sourceAccount: account,
      networkPassphrase: "Test Network ; February 2017",
      contractId: CONTRACT_ID,
      method: "claim_rewards"
    });

    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].type).toBe("invokeHostFunction");
  });
});

describe("ContractCallBuilder", () => {
  const NETWORK = "Test Network ; February 2017";
  const account = new Account(Keypair.random().publicKey(), "1");

  test("builds a transaction with fluent API", () => {
    const tx = new ContractCallBuilder()
      .setContract(CONTRACT_ID)
      .setMethod("deposit")
      .setArgs([1000n])
      .setFee(200_000)
      .setTimeout(30)
      .build(account, NETWORK);

    expect(tx.fee).toBe("200000");
    expect(tx.timeBounds).toBeDefined();
    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].type).toBe("invokeHostFunction");
  });

  test("uses default fee and timeout when not set", () => {
    const tx = new ContractCallBuilder()
      .setContract(CONTRACT_ID)
      .setMethod("balance")
      .build(account, NETWORK);

    expect(tx.fee).toBe("100000");
    expect(tx.timeBounds).toBeDefined();
  });

  test("buildOperation returns an invokeHostFunction operation", () => {
    const op = new ContractCallBuilder()
      .setContract(CONTRACT_ID)
      .setMethod("withdraw")
      .setArgs([500n])
      .buildOperation();

    expect(op).toBeDefined();
    expect((op as any)._attributes).toBeDefined();
  });

  test("throws if contractId is missing on build", () => {
    expect(() =>
      new ContractCallBuilder().setMethod("deposit").build(account, NETWORK)
    ).toThrow("contractId is required");
  });

  test("throws if method is missing on build", () => {
    expect(() =>
      new ContractCallBuilder().setContract(CONTRACT_ID).build(account, NETWORK)
    ).toThrow("method is required");
  });

  test("throws if contractId is missing on buildOperation", () => {
    expect(() =>
      new ContractCallBuilder().setMethod("deposit").buildOperation()
    ).toThrow("contractId is required");
  });

  test("throws if method is missing on buildOperation", () => {
    expect(() =>
      new ContractCallBuilder().setContract(CONTRACT_ID).buildOperation()
    ).toThrow("method is required");
  });

  test("supports no-arg contract calls", () => {
    const tx = new ContractCallBuilder()
      .setContract(CONTRACT_ID)
      .setMethod("claim_rewards")
      .build(account, NETWORK);

    expect(tx.operations.length).toBe(1);
    expect(tx.operations[0].type).toBe("invokeHostFunction");
  });
});
