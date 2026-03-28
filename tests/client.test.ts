import { StellarClient } from "../src";
import { RateLimitError } from "../src/errors/axionveraError";

describe("StellarClient", () => {
  test("delegates network calls to the RPC client", async () => {
    const rpc = {
      getHealth: jest.fn().mockResolvedValue({ status: "healthy" }),
      getNetwork: jest.fn().mockResolvedValue({ passphrase: "TESTNET" }),
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 123 }),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn()
    };

    const client = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc as any
    });

    await expect(client.getHealth()).resolves.toEqual({ status: "healthy" });
    await expect(client.getNetwork()).resolves.toEqual({ passphrase: "TESTNET" });
    await expect(client.getLatestLedger()).resolves.toEqual({ sequence: 123 });

    expect(rpc.getHealth).toHaveBeenCalledTimes(1);
    expect(rpc.getNetwork).toHaveBeenCalledTimes(1);
    expect(rpc.getLatestLedger).toHaveBeenCalledTimes(1);
  });

  test("maps sendTransaction hash/status regardless of field names", async () => {
    const rpc2 = {
      getHealth: jest.fn(),
      getNetwork: jest.fn(),
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn().mockResolvedValue({ id: "id-hash", statusText: "OK" }),
      getTransaction: jest.fn()
    };

    const client2 = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc2 as any
    });

    await expect(client2.sendTransaction({} as any)).resolves.toEqual({
      hash: "id-hash",
      status: "OK",
      raw: { id: "id-hash", statusText: "OK" }
    });

    expect(rpc2.sendTransaction).toHaveBeenCalledTimes(1);
  });

  test("exposes default network passphrase helper", () => {
    expect(StellarClient.getDefaultNetworkPassphrase("testnet")).toBe("Test SDF Network ; September 2015");
    expect(StellarClient.getDefaultNetworkPassphrase("mainnet")).toBe("Public Global Stellar Network ; September 2015");
  });

  test("pollTransaction times out when transaction remains NOT_FOUND", async () => {
    const rpc3 = {
      getHealth: jest.fn(),
      getNetwork: jest.fn(),
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn().mockResolvedValue({ status: "NOT_FOUND" })
    };

    const client3 = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc3 as any
    });

    await expect(client3.pollTransaction("deadbeef", { timeoutMs: 10, intervalMs: 1 })).rejects.toThrow(
      /Timed out waiting for transaction deadbeef/
    );
  });

  test("polls a transaction until it is found", async () => {
    const rpc = {
      getHealth: jest.fn(),
      getNetwork: jest.fn(),
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest
        .fn()
        .mockResolvedValueOnce({ status: "NOT_FOUND" })
        .mockResolvedValueOnce({ status: "SUCCESS", resultMetaXdr: "AAAA" })
    };

    const client = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc as any
    });

    await expect(
      client.pollTransaction("deadbeef", { timeoutMs: 2_000, intervalMs: 1 })
    ).resolves.toEqual({ status: "SUCCESS", resultMetaXdr: "AAAA" });

    expect(rpc.getTransaction).toHaveBeenCalledTimes(2);
  });

  test("wraps RPC errors with status code and request id metadata", async () => {
    const rpc = {
      getHealth: jest.fn().mockRejectedValue({
        response: {
          status: 429,
          headers: {
            'x-request-id': 'req-health-42'
          }
        }
      }),
      getNetwork: jest.fn(),
      getLatestLedger: jest.fn(),
      getAccount: jest.fn(),
      simulateTransaction: jest.fn(),
      prepareTransaction: jest.fn(),
      sendTransaction: jest.fn(),
      getTransaction: jest.fn()
    };

    const client = new StellarClient({
      network: "testnet",
      rpcUrl: "http://localhost:8000",
      networkPassphrase: "Test Network ; February 2017",
      rpcClient: rpc as any,
      retryConfig: { enabled: false }
    });

    let thrown: unknown;
    try {
      await client.getHealth();
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(RateLimitError);
    expect(thrown).toMatchObject({
      statusCode: 429,
      requestId: 'req-health-42'
    });
  });
});
