import { Account, Keypair, StrKey, Transaction } from "@stellar/stellar-sdk";

import { VaultContract } from "../src";
import { ValidationError } from "../src/errors/axionveraError";

describe("VaultContract", () => {
  test("builds, simulates, prepares, signs, and submits a deposit transaction", async () => {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();

    const account = new Account(publicKey, "1");

    const client = {
      networkPassphrase: "Test Network ; February 2017",
      getAccount: jest.fn().mockResolvedValue(account),
      simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: null } }),
      prepareTransaction: jest.fn(async (tx: Transaction) => tx),
      sendTransaction: jest.fn().mockResolvedValue({ hash: "abc", status: "PENDING" })
    };

    const wallet = {
      getPublicKey: jest.fn().mockResolvedValue(publicKey),
      signTransaction: jest.fn().mockImplementation(async (xdr: string) => xdr)
    };

    const vault = new VaultContract({
      client: client as any,
      contractId: StrKey.encodeContract(Buffer.alloc(32)),
      wallet: wallet as any
    });

    await expect(vault.deposit({ amount: 1_000n })).resolves.toEqual({
      hash: "abc",
      status: "PENDING"
    });

    expect(client.getAccount).toHaveBeenCalledWith(publicKey);
    expect(client.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(client.prepareTransaction).toHaveBeenCalledTimes(1);
    expect(wallet.signTransaction).toHaveBeenCalledTimes(1);
    expect(client.sendTransaction).toHaveBeenCalledTimes(1);
  });

  test("simulates and decodes getBalance", async () => {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const account = new Account(publicKey, "1");

    const client = {
      networkPassphrase: "Test Network ; February 2017",
      getAccount: jest.fn().mockResolvedValue(account),
      simulateTransaction: jest.fn().mockResolvedValue({
        result: { }
      })
    };

    const vault = new VaultContract({
      client: client as any,
      contractId: StrKey.encodeContract(Buffer.alloc(32))
    });

    await expect(vault.getBalance({ account: publicKey })).resolves.toBeNull();
    expect(client.getAccount).toHaveBeenCalledWith(publicKey);
    expect(client.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  test("throws when wallet is missing for deposit", async () => {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const account = new Account(publicKey, "1");

    const client = {
      networkPassphrase: "Test Network ; February 2017",
      getAccount: jest.fn().mockResolvedValue(account),
      simulateTransaction: jest.fn().mockResolvedValue({ result: { retval: null } })
    };

    const vault = new VaultContract({
      client: client as any,
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef"
    });

    await expect(vault.deposit({ amount: 1000n })).rejects.toThrow(
      /wallet connector is required for signing transactions/
    );
  });

  test("throws when no account and no wallet on getBalance", async () => {
    const client = {
      networkPassphrase: "Test Network ; February 2017",
      getAccount: jest.fn(),
      simulateTransaction: jest.fn()
    };

    const vault = new VaultContract({
      client: client as any,
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef"
    });

    await expect(vault.getBalance({} as any)).rejects.toThrow(
      /account is required when no wallet connector is provided/
    );
  });

  test("simulated contract call failure propagates in getBalance", async () => {
    const keypair = Keypair.random();
    const publicKey = keypair.publicKey();
    const account = new Account(publicKey, "1");

    const client = {
      networkPassphrase: "Test Network ; February 2017",
      getAccount: jest.fn().mockResolvedValue(account),
      simulateTransaction: jest.fn().mockResolvedValue({ error: "Sim failed" })
    };

    const vault = new VaultContract({
      client: client as any,
      contractId: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef"
    });

    await expect(vault.getBalance({ account: publicKey })).rejects.toThrow(/Simulation failed/);
  });
});
