import { Keypair, TransactionBuilder, Networks, xdr } from "@stellar/stellar-sdk";
import { StellarClient } from "../src/client/stellarClient";
import { setupMswTest, overrideHandlers, rest } from "../src/index";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("StellarClient Unit Tests", () => {
  // Establish the mocked network interfaces using MSW as per project standards
  // This prevents tests from hitting live servers and ensures consistent results
  setupMswTest();

  describe("Initialization", () => {
    it("should initialize with default testnet settings", () => {
      const client = new StellarClient({ network: "testnet" });
      expect(client.network).toBe("testnet");
      expect(client.rpcUrl).toBe("https://soroban-testnet.stellar.org");
      expect(client.networkPassphrase).toBe(Networks.TESTNET);
    });

    it("should initialize with custom RPC URL and passphrase", () => {
      const customRpc = "https://custom-rpc.com";
      const customPassphrase = "Custom Network ; September 2023";
      const client = new StellarClient({
        rpcUrl: customRpc,
        networkPassphrase: customPassphrase
      });
      expect(client.rpcUrl).toBe(customRpc);
      expect(client.networkPassphrase).toBe(customPassphrase);
    });

    it("should merge concurrency configuration", () => {
      const client = new StellarClient({
        concurrencyConfig: { maxConcurrentRequests: 10 }
      });
      const stats = client.getConcurrencyStats();
      expect(stats.enabled).toBe(true);
      expect(stats.maxConcurrentRequests).toBe(10);
    });
  });

  describe("Core RPC Methods (Mocked)", () => {
    let client: StellarClient;

    beforeEach(() => {
      client = new StellarClient({ network: "testnet" });
    });

    it("should fetch network health via mocked interface", async () => {
      const health = await client.getHealth();
      expect(health).toEqual({ status: "healthy", version: "20.0.0" });
    });

    it("should fetch account details via mocked interface", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);
      expect(account.accountId()).toBe(publicKey);
    });

    it("should handle RPC errors gracefully", async () => {
      // Manually override for error simulation
      overrideHandlers(
        rest.get("https://soroban-testnet.stellar.org/health", (_req, res, ctx) => {
          return res(ctx.status(500), ctx.json({ error: "Internal Server Error" }));
        })
      );

      await expect(client.getHealth()).rejects.toThrow("Failed to fetch network health");
    });

    it("should retry on transient RPC errors", async () => {
      let attempts = 0;
      // Simulate a transient error that succeeds on the 3rd attempt
      overrideHandlers(
        rest.get("https://soroban-testnet.stellar.org/health", (_req, res, ctx) => {
          attempts++;
          if (attempts < 3) {
            return res(ctx.status(500));
          }
          return res(ctx.json({ status: "healthy", version: "20.0.0" }));
        })
      );

      const health = await client.getHealth();
      expect(attempts).toBe(3);
      expect(health.status).toBe("healthy");
    });
  });

  describe("Authentication and Signing Flow", () => {
    it("should sign a transaction with a local keypair", async () => {
      const client = new StellarClient({ network: "testnet" });
      const sourceKeypair = Keypair.random();
      const destination = Keypair.random().publicKey();
      
      // Use the client to get an Account object (mocked) for the builder
      const account = await client.getAccount(sourceKeypair.publicKey());
      
      const tx = new TransactionBuilder(account, {
        fee: "100",
        networkPassphrase: client.networkPassphrase
      })
        .addOperation(TransactionBuilder.payment({
          destination,
          asset: TransactionBuilder.native(),
          amount: "10"
        }))
        .setTimeout(30)
        .build();

      const signedTx = await client.signWithKeypair(tx, sourceKeypair);
      expect(signedTx.signatures.length).toBe(1);
    });
  });

  describe("Contract Event Bridge", () => {
    it("should emit parsed contract events from subscribeToEvents", async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      const client = new StellarClient({
        network: "testnet",
        logLevel: "debug",
        logger: mockLogger,
      });

      const latestLedger = deferred<any>();
      const events = deferred<any>();
      (client as any).rpc = {
        getLatestLedger: jest.fn(() => latestLedger.promise),
        getEvents: jest.fn(() => events.promise),
      };

      const emitter = client.subscribeToEvents("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7YI", ["VaultDeposit"], 1);
      const handler = jest.fn();
      emitter.on("VaultDeposit", handler);

      latestLedger.resolve({ sequence: 42 });
      events.resolve({
        cursor: "cursor-1",
        events: [
          {
            id: "event-1",
            type: "contract",
            ledger: 43,
            ledgerClosedAt: "2025-04-25T00:00:00Z",
            transactionIndex: 0,
            operationIndex: 0,
            inSuccessfulContractCall: true,
            txHash: "abc123",
            contractId: { toString: () => "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7YI" },
            topic: [xdr.ScVal.scvSymbol("VaultDeposit")],
            value: xdr.ScVal.scvString("100"),
          },
        ],
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler.mock.calls[0][0].eventName).toBe("VaultDeposit");
      expect(handler.mock.calls[0][0].topicNames).toContain("VaultDeposit");
      expect(handler.mock.calls[0][0].contractId).toBe("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7YI");

      emitter.close();
    });
  });
});
