import { Keypair, TransactionBuilder, Networks, Contract, StrKey, nativeToScVal } from "@stellar/stellar-sdk";
import { StellarClient, buildContractCallOperation } from "../src";
import { setupMswTest, overrideHandlers, rest } from "../src/index";

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

  describe("simulateBatch", () => {
    let client: StellarClient;

    beforeEach(() => {
      client = new StellarClient({ network: "testnet" });
    });

    it("should simulate multiple operations in a single batch", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      // Create two contract call operations
      const contractId1 = StrKey.encodeContract(Buffer.alloc(32, 1));
      const contractId2 = StrKey.encodeContract(Buffer.alloc(32, 2));

      const op1 = buildContractCallOperation({
        contractId: contractId1,
        method: "deposit",
        args: [nativeToScVal(1000, { type: "i128" })]
      });

      const op2 = buildContractCallOperation({
        contractId: contractId2,
        method: "deposit",
        args: [nativeToScVal(2000, { type: "i128" })]
      });

      // Mock the batch simulation response
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org/simulate_transaction", (_req, res, ctx) => {
          return res(ctx.json({
            result: [
              { xdr: "AQAAAAAA" },
              { xdr: "BQAAAAAA" }
            ]
          }));
        })
      );

      const results = await client.simulateBatch({
        operations: [op1, op2],
        sourceAccount: account
      });

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty("xdr");
      expect(results[1]).toHaveProperty("xdr");
    });

    it("should throw error when operations array is empty", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      await expect(
        client.simulateBatch({
          operations: [],
          sourceAccount: account
        })
      ).rejects.toThrow("At least one operation is required for batch simulation");
    });

    it("should handle single operation batch simulation", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
      const op = buildContractCallOperation({
        contractId,
        method: "withdraw",
        args: [nativeToScVal(500, { type: "i128" })]
      });

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org/simulate_transaction", (_req, res, ctx) => {
          return res(ctx.json({
            result: [
              { xdr: "AQAAAAAA" }
            ]
          }));
        })
      );

      const results = await client.simulateBatch({
        operations: [op],
        sourceAccount: account
      });

      expect(results).toHaveLength(1);
    });

    it("should use custom fee when provided", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
      const op = buildContractCallOperation({
        contractId,
        method: "deposit",
        args: [nativeToScVal(1000, { type: "i128" })]
      });

      let capturedFee: string | undefined;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org/simulate_transaction", (req, res, ctx) => {
          // Capture the fee from the request body
          const bodyText = req.body as string;
          const match = bodyText.match(/"fee":"(\d+)"/);
          if (match) {
            capturedFee = match[1];
          }
          return res(ctx.json({
            result: [
              { xdr: "AQAAAAAA" }
            ]
          }));
        })
      );

      const customFee = 50_000;
      await client.simulateBatch({
        operations: [op],
        sourceAccount: account,
        fee: customFee
      });

      // With 1 operation and 50_000 fee per op, total should be 50_000
      expect(capturedFee).toBe("50000");
    });

    it("should calculate total fee as fee * number of operations", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
      const op1 = buildContractCallOperation({
        contractId,
        method: "deposit",
        args: [nativeToScVal(1000, { type: "i128" })]
      });
      const op2 = buildContractCallOperation({
        contractId,
        method: "withdraw",
        args: [nativeToScVal(500, { type: "i128" })]
      });
      const op3 = buildContractCallOperation({
        contractId,
        method: "claim_rewards",
        args: []
      });

      let capturedFee: string | undefined;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org/simulate_transaction", (req, res, ctx) => {
          const bodyText = req.body as string;
          const match = bodyText.match(/"fee":"(\d+)"/);
          if (match) {
            capturedFee = match[1];
          }
          return res(ctx.json({
            result: [
              { xdr: "AQAAAAAA" },
              { xdr: "BQAAAAAA" },
              { xdr: "CQAAAAAA" }
            ]
          }));
        })
      );

      const customFee = 100_000;
      await client.simulateBatch({
        operations: [op1, op2, op3],
        sourceAccount: account,
        fee: customFee
      });

      // With 3 operations and 100_000 fee per op, total should be 300_000
      expect(capturedFee).toBe("300000");
    });

    it("should handle simulation errors", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
      const op = buildContractCallOperation({
        contractId,
        method: "deposit",
        args: [nativeToScVal(1000, { type: "i128" })]
      });

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org/simulate_transaction", (_req, res, ctx) => {
          return res(ctx.json({
            error: "Simulation failed"
          }));
        })
      );

      await expect(
        client.simulateBatch({
          operations: [op],
          sourceAccount: account
        })
      ).rejects.toThrow("Simulation failed");
    });

    it("should use custom timeout when provided", async () => {
      const publicKey = "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
      const account = await client.getAccount(publicKey);

      const contractId = StrKey.encodeContract(Buffer.alloc(32, 1));
      const op = buildContractCallOperation({
        contractId,
        method: "deposit",
        args: [nativeToScVal(1000, { type: "i128" })]
      });

      let capturedTimeout: string | undefined;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org/simulate_transaction", (req, res, ctx) => {
          const bodyText = req.body as string;
          const match = bodyText.match(/"timeBounds":\{"minTime":"0","maxTime":"(\d+)"/);
          if (match) {
            capturedTimeout = match[1];
          }
          return res(ctx.json({
            result: [
              { xdr: "AQAAAAAA" }
            ]
          }));
        })
      );

      const customTimeout = 120;
      await client.simulateBatch({
        operations: [op],
        sourceAccount: account,
        timeoutInSeconds: customTimeout
      });

      // The timeout is converted to absolute time, so it should exist
      expect(capturedTimeout).toBeDefined();
    });
  });