import { StellarClient } from "@axionvera/core";
import { xdr } from "@stellar/stellar-sdk";

// Mock the RPC server for testing
jest.mock("@stellar/stellar-sdk", () => {
  const originalModule = jest.requireActual("@stellar/stellar-sdk");
  
  return {
    ...originalModule,
    rpc: {
      ...originalModule.rpc,
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: jest.fn(),
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
        getTransaction: jest.fn(),
      }))
    }
  };
});

describe("simulateRead", () => {
  let client: StellarClient;
  let mockRpc: any;

  beforeEach(() => {
    client = new StellarClient({ network: "testnet" });
    mockRpc = client.rpc;
  });

  test("should simulate a simple read-only contract call", async () => {
    const mockResult = {
      result: [xdr.ScVal.scvU32(42)], // Return a simple number
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    const result = await client.simulateRead(
      "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
      "get_balance",
      ["token"]
    );

    expect(result).toBeDefined();
    expect(result.switch().name).toBe("SCV_U32");
    expect(result.u32()).toBe(42);
    expect(mockRpc.simulateTransaction).toHaveBeenCalledTimes(1);
  });

  test("should simulate a read-only call with multiple arguments", async () => {
    const mockResult = {
      result: [xdr.ScVal.scvString("Hello World")],
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    const result = await client.simulateRead(
      "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
      "concat_strings",
      ["Hello", "World"]
    );

    expect(result).toBeDefined();
    expect(result.switch().name).toBe("SCV_STRING");
    expect(result.str().toString()).toBe("Hello World");
  });

  test("should simulate a read-only call with no arguments", async () => {
    const mockResult = {
      result: [xdr.ScVal.scvBool(true)],
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    const result = await client.simulateRead(
      "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
      "is_active"
    );

    expect(result).toBeDefined();
    expect(result.switch().name).toBe("SCV_BOOL");
    expect(result.bool()).toBe(true);
  });

  test("should handle different argument types", async () => {
    const mockResult = {
      result: [xdr.ScVal.scvU64(1000000)],
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    const result = await client.simulateRead(
      "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
      "calculate_reward",
      [123, "token", true, null]
    );

    expect(result).toBeDefined();
    expect(result.switch().name).toBe("SCV_U64");
    expect(result.u64().toString()).toBe("1000000");
  });

  test("should throw error when simulation fails", async () => {
    const mockError = {
      result: null,
      error: "Contract execution failed",
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockError);

    await expect(
      client.simulateRead(
        "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
        "nonexistent_method"
      )
    ).rejects.toThrow("Simulation failed: Contract execution failed");
  });

  test("should throw error when no result is returned", async () => {
    const mockResult = {
      result: null,
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    await expect(
      client.simulateRead(
        "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
        "get_balance"
      )
    ).rejects.toThrow("No result returned from simulation");
  });

  test("should throw error when empty result array is returned", async () => {
    const mockResult = {
      result: [],
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    await expect(
      client.simulateRead(
        "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
        "get_balance"
      )
    ).rejects.toThrow("No results returned from simulation");
  });

  test("should handle network errors gracefully", async () => {
    mockRpc.simulateTransaction.mockRejectedValue(new Error("Network unreachable"));

    await expect(
      client.simulateRead(
        "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
        "get_balance"
      )
    ).rejects.toThrow("Failed to simulate read call");
  });

  test("should use dummy account for simulation", async () => {
    const mockResult = {
      result: [xdr.ScVal.scvU32(123)],
      error: null,
      transactionData: null,
      events: null,
      latestLedger: 12345
    };

    mockRpc.simulateTransaction.mockResolvedValue(mockResult);

    await client.simulateRead(
      "CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C",
      "get_value"
    );

    // Verify that simulateTransaction was called
    expect(mockRpc.simulateTransaction).toHaveBeenCalledTimes(1);
    
    // Get the transaction that was passed to simulateTransaction
    const simulatedTx = mockRpc.simulateTransaction.mock.calls[0][0];
    
    // Verify it uses the dummy account
    expect(simulatedTx.sourceAccount().accountId()).toBe("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH");
    expect(simulatedTx.sequence).toBe("0");
    expect(simulatedTx.fee.toString()).toBe("100");
  });
});
