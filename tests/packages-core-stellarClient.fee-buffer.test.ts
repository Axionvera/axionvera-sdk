import { Networks, SorobanDataBuilder, TransactionBuilder } from "@stellar/stellar-sdk";
import { StellarClient } from "../packages/core/src/client/stellarClient";
import { ValidationError } from "../packages/core/src/errors/axionveraError";

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");

  return {
    ...actual,
    rpc: {
      ...actual.rpc,
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: jest.fn(),
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
        getTransaction: jest.fn(),
      })),
    },
  };
});

function assembledTransaction(sorobanData: ReturnType<SorobanDataBuilder["build"]>) {
  return {
    fee: "2100",
    networkPassphrase: Networks.TESTNET,
    toEnvelope: () => ({
      v1: () => ({
        tx: () => ({
          ext: () => ({
            value: () => sorobanData
          })
        })
      })
    })
  } as any;
}

describe("packages/core StellarClient fee buffering", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("exposes applyFeeBuffer and uses maxFeeLimit / webSocketManager", () => {
    const client = new StellarClient({ network: "testnet", maxFeeLimit: 5000 });
    expect(typeof client.applyFeeBuffer).toBe("function");
    expect(client.webSocketManager).toBeNull();
    expect(typeof client.disconnectWebSocket).toBe("function");
    client.disconnectWebSocket();
  });

  it("buffers Soroban resource limits and fees", () => {
    const client = new StellarClient({ network: "testnet", feeBufferMultiplier: 1.15 });
    const sorobanData = new SorobanDataBuilder()
      .setResources(1000, 2000, 3000)
      .setResourceFee("2000")
      .build();

    const assembledTx = assembledTransaction(sorobanData);
    const bufferedTx = { id: "buffered" } as any;
    let cloneOptions: any;

    jest.spyOn(TransactionBuilder, "cloneFrom").mockImplementation((_tx, options) => {
      cloneOptions = options;
      return {
        build: () => bufferedTx
      } as any;
    });

    const result = client.applyFeeBuffer(assembledTx);

    expect(result).toBe(bufferedTx);
    expect(cloneOptions.fee).toBe("115");
    expect(cloneOptions.sorobanData.resourceFee().toBigInt()).toBe(BigInt(2300));
    expect(cloneOptions.sorobanData.resources().instructions()).toBe(1150);
    expect(cloneOptions.sorobanData.resources().diskReadBytes()).toBe(2300);
    expect(cloneOptions.sorobanData.resources().writeBytes()).toBe(3450);
  });

  it("throws when the buffered fee exceeds maxFeeLimit", () => {
    const client = new StellarClient({
      network: "testnet",
      feeBufferMultiplier: 1.15,
      maxFeeLimit: 2300
    });
    const sorobanData = new SorobanDataBuilder()
      .setResources(1000, 2000, 3000)
      .setResourceFee("2000")
      .build();

    expect(() => client.applyFeeBuffer(assembledTransaction(sorobanData))).toThrow(ValidationError);
    expect(() => client.applyFeeBuffer(assembledTransaction(sorobanData))).toThrow(
      "Buffered fee (2415) exceeds maxFeeLimit (2300)"
    );
  });
});
