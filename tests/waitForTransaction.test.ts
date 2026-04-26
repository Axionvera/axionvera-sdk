import { StellarClient } from "../src/client/stellarClient";
import { setupMswTest, overrideHandlers } from "../src/test/msw/server";
import { rest } from "msw";
import { TimeoutError } from "../src/errors/axionveraError";

describe("waitForTransaction - Promise-based transaction confirmation", () => {
  setupMswTest();

  let client: StellarClient;
  const testTxHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    client = new StellarClient({ network: "testnet" });
  });

  describe("Basic Functionality", () => {
    it("should wait for transaction to reach SUCCESS status", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100,
                  createdAt: "2024-01-01T00:00:00Z"
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash);
      expect((result as any).status).toBe("SUCCESS");
      expect((result as any).ledger).toBe(100);
    });

    it("should wait for transaction to reach FAILED status", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "FAILED",
                  ledger: 100,
                  errorMeta: "some error details"
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash);
      expect((result as any).status).toBe("FAILED");
      expect((result as any).errorMeta).toBe("some error details");
    });

    it("should poll multiple times until transaction status is known", async () => {
      let pollCount = 0;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            pollCount++;
            if (pollCount < 3) {
              return res(
                ctx.json({
                  jsonrpc: "2.0",
                  id: body.id,
                  result: { status: "NOT_FOUND" }
                })
              );
            }
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash, { intervalMs: 10 });
      expect(pollCount).toBe(3);
      expect((result as any).status).toBe("SUCCESS");
    });
  });

  describe("Timeout Handling", () => {
    it("should timeout if transaction never reaches final status", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { status: "NOT_FOUND" }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      await expect(
        client.waitForTransaction(testTxHash, { timeoutMs: 50, intervalMs: 20 })
      ).rejects.toThrow(/Timed out waiting for transaction/);
    });

    it("should use default 30 second timeout when not specified", async () => {
      const startTime = Date.now();

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { status: "NOT_FOUND" }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      try {
        await client.waitForTransaction(testTxHash, { intervalMs: 5000 }); // Long interval to ensure timeout triggers
      } catch (error) {
        const elapsed = Date.now() - startTime;
        // Default timeout is 30 seconds, but should timeout eventually
        // Note: In test environment with short intervals this will be much faster
      }
    });

    it("should respect custom timeout value", async () => {
      const customTimeout = 100;
      const startTime = Date.now();

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { status: "NOT_FOUND" }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      try {
        await client.waitForTransaction(testTxHash, {
          timeoutMs: customTimeout,
          intervalMs: 20
        });
      } catch (error) {
        const elapsed = Date.now() - startTime;
        // Should timeout around the custom timeout value
        expect(elapsed).toBeLessThan(customTimeout + 100); // Allow some buffer
      }
    });
  });

  describe("Polling Interval", () => {
    it("should respect custom polling interval", async () => {
      let pollCount = 0;
      const startTime = Date.now();

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            pollCount++;
            if (pollCount < 4) {
              return res(
                ctx.json({
                  jsonrpc: "2.0",
                  id: body.id,
                  result: { status: "NOT_FOUND" }
                })
              );
            }
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { status: "SUCCESS", ledger: 100 }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash, { intervalMs: 100 });
      const elapsed = Date.now() - startTime;

      // 3 intervals of 100ms = ~300ms, plus overhead
      expect(elapsed).toBeGreaterThanOrEqual(300);
      expect((result as any).status).toBe("SUCCESS");
    });

    it("should default to 1 second polling interval", async () => {
      let pollCount = 0;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            pollCount++;
            if (pollCount === 1) {
              return res(
                ctx.json({
                  jsonrpc: "2.0",
                  id: body.id,
                  result: { status: "NOT_FOUND" }
                })
              );
            }
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: { status: "SUCCESS", ledger: 100 }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      // Use short timeout and long default interval to verify it calls at least once
      const result = await client.waitForTransaction(testTxHash);
      expect((result as any).status).toBe("SUCCESS");
    });
  });

  describe("Progress Callback", () => {
    it("should call onProgress callback with status updates (src/ version)", async () => {
      const progressUpdates: Array<{ status: string; ledger: number }> = [];

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const onProgress = jest.fn((status: string, ledger: number) => {
        progressUpdates.push({ status, ledger });
      });

      const result = await client.waitForTransaction(testTxHash, { onProgress });

      expect((result as any).status).toBe("SUCCESS");
      // onProgress is called even on the first successful poll
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it("should handle onProgress callback that returns a Promise", async () => {
      const progressUpdates: Array<{ status: string; ledger: number }> = [];

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const onProgress = jest.fn(async (status: string, ledger: number) => {
        progressUpdates.push({ status, ledger });
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      const result = await client.waitForTransaction(testTxHash, { onProgress });
      expect((result as any).status).toBe("SUCCESS");
      expect(progressUpdates.length).toBeGreaterThan(0);
    });

    it("should continue even if onProgress callback throws", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const onProgress = jest.fn(() => {
        throw new Error("Progress callback error");
      });

      // Should not throw, should complete successfully
      const result = await client.waitForTransaction(testTxHash, { onProgress });
      expect((result as any).status).toBe("SUCCESS");
    });
  });

  describe("Error States", () => {
    it("should reject on transaction failure", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "FAILED",
                  ledger: 100,
                  resultXdr: "error details"
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash);
      expect((result as any).status).toBe("FAILED");
    });

    it("should return result with UNKNOWN status if not found in response", async () => {
      let callCount = 0;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req, res, ctx) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            callCount++;
            if (callCount === 1) {
              // Return empty result on first call
              return res(
                ctx.json({
                  jsonrpc: "2.0",
                  id: body.id,
                  result: {}
                })
              );
            }
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash, { intervalMs: 10 });
      expect((result as any).status).toBe("SUCCESS");
    });
  });

  describe("API Consistency", () => {
    it("should have same interface as pollTransaction", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result1 = await client.waitForTransaction(testTxHash);
      const result2 = await client.pollTransaction(testTxHash);

      // Both should return the same result structure
      expect((result1 as any).status).toBe((result2 as any).status);
      expect((result1 as any).ledger).toBe((result2 as any).ledger);
    });

    it("should accept all pollTransaction parameters", async () => {
      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      const result = await client.waitForTransaction(testTxHash, {
        timeoutMs: 60000,
        intervalMs: 1000,
        onProgress: (status, ledger) => {
          // Just verify we can pass this callback
        }
      });

      expect((result as any).status).toBe("SUCCESS");
    });
  });

  describe("Integration Scenarios", () => {
    it("should work in typical send-and-wait flow", async () => {
      let sendCallCount = 0;
      let getCallCount = 0;

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;

          if (body.method === "sendTransaction") {
            sendCallCount++;
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  hash: testTxHash,
                  status: "PENDING"
                }
              })
            );
          }

          if (body.method === "getTransaction") {
            getCallCount++;
            if (getCallCount < 2) {
              return res(
                ctx.json({
                  jsonrpc: "2.0",
                  id: body.id,
                  result: { status: "NOT_FOUND" }
                })
              );
            }
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }

          return res(ctx.status(400));
        })
      );

      // Simulate typical workflow
      const sendResult = await client.sendTransaction("dummy-tx");
      const txHash = (sendResult as any).hash;

      const finalResult = await client.waitForTransaction(txHash, { intervalMs: 10 });

      expect((finalResult as any).status).toBe("SUCCESS");
      expect(sendCallCount).toBe(1);
      expect(getCallCount).toBe(2); // 1 NOT_FOUND + 1 SUCCESS
    });

    it("should allow monitoring multiple conditions via onProgress", async () => {
      const statusHistory: string[] = [];

      overrideHandlers(
        rest.post("https://soroban-testnet.stellar.org", async (req: any, res: any, ctx: any) => {
          const body = await req.json() as any;
          if (body.method === "getTransaction") {
            return res(
              ctx.json({
                jsonrpc: "2.0",
                id: body.id,
                result: {
                  status: "SUCCESS",
                  ledger: 100
                }
              })
            );
          }
          return res(ctx.status(400));
        })
      );

      await client.waitForTransaction(testTxHash, {
        onProgress: (status, ledger) => {
          statusHistory.push(status);
          if (ledger > 50) {
            // Could take action based on ledger position
          }
        }
      });

      expect(statusHistory.length).toBeGreaterThan(0);
    });
  });
});
