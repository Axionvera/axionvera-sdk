import { xdr } from "@stellar/stellar-sdk";
import { StellarClient } from "../src/client/stellarClient";

describe("StellarClient getContractEvents", () => {
  beforeEach(() => {
    jest.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calculates startLedger from last24Hours and decodes topics/value", async () => {
    const mockRpc = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 200_000 }),
      getEvents: jest.fn().mockResolvedValue({
        events: [
          {
            topic: [xdr.ScVal.scvSymbol("Deposit").toXDR("base64")],
            value: xdr.ScVal.scvBool(true).toXDR("base64"),
            ledger: 199_900,
            pagingToken: "page-1"
          }
        ],
        pagingToken: "page-1"
      })
    };

    const client = new StellarClient({
      network: "testnet",
      rpcClient: mockRpc as any
    });

    const result = await client.getContractEvents("C123", undefined, {
      startTime: "last24Hours"
    });

    expect(mockRpc.getEvents).toHaveBeenCalledTimes(1);
    const request = mockRpc.getEvents.mock.calls[0][0];
    expect(request.startLedger).toBe(182_720);
    expect(result.events[0]?.topic[0]).toBe("Deposit");
    expect(result.events[0]?.value).toBe(true);
    expect(result.pagingToken).toBe("page-1");
  });

  it("fetches all pages when fetchAll is true", async () => {
    const mockRpc = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 500 }),
      getEvents: jest
        .fn()
        .mockResolvedValueOnce({
          events: [
            {
              topic: [xdr.ScVal.scvSymbol("Deposit").toXDR("base64")],
              value: xdr.ScVal.scvString("first").toXDR("base64"),
              ledger: 490
            }
          ],
          pagingToken: "next-cursor"
        })
        .mockResolvedValueOnce({
          events: [
            {
              topic: [xdr.ScVal.scvSymbol("Withdraw").toXDR("base64")],
              value: xdr.ScVal.scvString("second").toXDR("base64"),
              ledger: 491
            }
          ]
        })
    };

    const client = new StellarClient({
      network: "testnet",
      rpcClient: mockRpc as any
    });

    const result = await client.getContractEvents("C123", undefined, {
      startLedger: 490,
      endLedger: 500,
      limit: 1,
      fetchAll: true
    });

    expect(mockRpc.getEvents).toHaveBeenCalledTimes(2);
    expect(mockRpc.getEvents.mock.calls[1][0].pagination.cursor).toBe("next-cursor");
    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.value).toBe("first");
    expect(result.events[1]?.value).toBe("second");
    expect(result.pagingToken).toBeUndefined();
  });

  it("halves ledger range and retries on 413 payload too large", async () => {
    const mockRpc = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 200 }),
      getEvents: jest
        .fn()
        .mockRejectedValueOnce({ response: { status: 413 }, message: "Payload Too Large" })
        .mockResolvedValueOnce({ events: [] })
    };

    const client = new StellarClient({
      network: "testnet",
      rpcClient: mockRpc as any
    });

    await client.getContractEvents("C123", undefined, {
      startLedger: 100,
      endLedger: 200
    });

    expect(mockRpc.getEvents).toHaveBeenCalledTimes(2);
    const retriedRequest = mockRpc.getEvents.mock.calls[1][0];
    expect(retriedRequest.startLedger).toBe(100);
    expect(retriedRequest.endLedger).toBe(150);
  });

  it("stops pagination when pagingToken repeats", async () => {
    const mockRpc = {
      getLatestLedger: jest.fn().mockResolvedValue({ sequence: 700 }),
      getEvents: jest
        .fn()
        .mockResolvedValueOnce({
          events: [
            {
              topic: [xdr.ScVal.scvSymbol("Deposit").toXDR("base64")],
              value: xdr.ScVal.scvString("first").toXDR("base64"),
              ledger: 690
            }
          ],
          pagingToken: "repeated-token"
        })
        .mockResolvedValueOnce({
          events: [
            {
              topic: [xdr.ScVal.scvSymbol("Withdraw").toXDR("base64")],
              value: xdr.ScVal.scvString("second").toXDR("base64"),
              ledger: 691
            }
          ],
          pagingToken: "repeated-token"
        })
    };

    const client = new StellarClient({
      network: "testnet",
      rpcClient: mockRpc as any
    });

    const result = await client.getContractEvents("C123", undefined, {
      startLedger: 690,
      endLedger: 700,
      fetchAll: true
    });

    expect(mockRpc.getEvents).toHaveBeenCalledTimes(2);
    expect(result.events).toHaveLength(2);
    expect(result.pagingToken).toBe("repeated-token");
  });
});
