import { Networks, rpc, SorobanDataBuilder, TransactionBuilder } from "@stellar/stellar-sdk";
import { StellarClient } from "../src/client/stellarClient";
import { ValidationError } from "../src/errors/axionveraError";

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

describe("StellarClient fee buffering", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("buffers Soroban resource limits and fees during transaction preparation", async () => {
    const client = new StellarClient({ network: "testnet", feeBufferMultiplier: 1.15 });
    const mockRpc = client.rpc as any;
    const simulation = { id: "simulation" };
    const sorobanData = new SorobanDataBuilder()
      .setResources(1000, 2000, 3000)
      .setResourceFee("2000")
      .build();

    const assembledTx = {
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

    const bufferedTx = { id: "buffered" } as any;
    let cloneOptions: any;

    mockRpc.simulateTransaction.mockResolvedValue(simulation);
    jest.spyOn(rpc, "assembleTransaction").mockReturnValue({
      build: () => assembledTx
    } as any);
    jest.spyOn(TransactionBuilder, "cloneFrom").mockImplementation((_tx, options) => {
      cloneOptions = options;
      return {
        build: () => bufferedTx
      } as any;
    });

    const result = await client.prepareTransaction({ id: "raw-tx" } as any);

    expect(result).toBe(bufferedTx);
    expect(mockRpc.simulateTransaction).toHaveBeenCalledTimes(1);
    expect(cloneOptions.fee).toBe("115");
    expect(cloneOptions.sorobanData.resourceFee().toBigInt()).toBe(BigInt(2300));
    expect(cloneOptions.sorobanData.resources().instructions()).toBe(1150);
    expect(cloneOptions.sorobanData.resources().diskReadBytes()).toBe(2300);
    expect(cloneOptions.sorobanData.resources().writeBytes()).toBe(3450);
  });

  it("throws when the buffered fee exceeds maxFeeLimit", async () => {
    const client = new StellarClient({
      network: "testnet",
      feeBufferMultiplier: 1.15,
      maxFeeLimit: 2300
    });
    const mockRpc = client.rpc as any;
    const sorobanData = new SorobanDataBuilder()
      .setResources(1000, 2000, 3000)
      .setResourceFee("2000")
      .build();

    const assembledTx = {
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

    mockRpc.simulateTransaction.mockResolvedValue({ id: "simulation" });
    jest.spyOn(rpc, "assembleTransaction").mockReturnValue({
      build: () => assembledTx
    } as any);

    const preparedPromise = client.prepareTransaction({ id: "raw-tx" } as any);

    await expect(preparedPromise).rejects.toThrow(ValidationError);
    await expect(preparedPromise).rejects.toThrow("Buffered fee (2415) exceeds maxFeeLimit (2300)");
  });
});
