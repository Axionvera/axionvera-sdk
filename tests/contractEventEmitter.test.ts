import { xdr } from "@stellar/stellar-sdk";
import { StellarClient } from "../packages/core/src/client/stellarClient";
import { ContractEventEmitter } from "../packages/core/src/contracts/ContractEventEmitter";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

describe("ContractEventEmitter bridge", () => {
  it("should emit parsed contract events from the core client", async () => {
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

    const emitter = client.subscribeToEvents("CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB7YI", ["VaultDeposit"], 1) as ContractEventEmitter;
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
