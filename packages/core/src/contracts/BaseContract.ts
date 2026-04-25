import { Address, nativeToScVal, rpc, xdr } from "@stellar/stellar-sdk";
import { StellarClient } from "../client/stellarClient";
import { WalletConnector } from "../wallet/walletConnector";
import { TransactionSigner, ContractCallParams } from "../transaction/transactionSigner";
import { buildContractCallOperation, ContractCallArg } from "../utils/transactionBuilder";
import { decodeXdrBase64 } from "../utils/xdrCache";

export type BaseContractConfig = {
  client: StellarClient;
  contractId: string;
  wallet: WalletConnector;
};

/**
 * Abstract base class for all generated Soroban contract wrappers.
 * Provides shared infrastructure for building, signing, and simulating transactions.
 */
export abstract class BaseContract {
  protected readonly client: StellarClient;
  protected readonly contractId: string;
  protected readonly wallet: WalletConnector;
  protected readonly signer: TransactionSigner;

  constructor(config: BaseContractConfig) {
    this.client = config.client;
    this.contractId = config.contractId;
    this.wallet = config.wallet;
    this.signer = new TransactionSigner({ client: this.client, wallet: this.wallet });
  }

  /**
   * Invoke a mutating contract method (builds, signs, and submits a transaction).
   */
  protected async invoke(method: string, args: ContractCallArg[]): Promise<any> {
    const sourceAccount = await this.wallet.getPublicKey();
    const call: ContractCallParams = { contractId: this.contractId, method, args };
    return this.signer.buildAndSignTransaction({ sourceAccount, operations: [call] });
  }

  /**
   * Query a read-only contract method via simulation (no transaction submitted).
   */
  protected async query(method: string, args: ContractCallArg[]): Promise<xdr.ScVal> {
    const sourceAccount = await this.wallet.getPublicKey();
    const call: ContractCallParams = { contractId: this.contractId, method, args };
    const tx = await this.signer.buildTransaction({ sourceAccount, operations: [call] });
    const simulation = await this.client.simulateTransaction(tx);

    if (!rpc.Api.isSimulationSuccess(simulation)) {
      throw new Error(`Simulation failed for ${method}: ${(simulation as any).error}`);
    }

    const result = simulation.results?.[0];
    if (!result) throw new Error(`No simulation result for ${method}`);
    return decodeXdrBase64(result.xdr);
  }

  /** Decode an i128 ScVal to bigint. */
  protected decodeI128(val: xdr.ScVal): bigint {
    if (val.switch() !== xdr.ScValType.scvI128()) throw new Error("Expected i128");
    const i = val.i128();
    return BigInt(i.low().toString()) + (BigInt(i.high().toString()) << 64n);
  }

  /** Decode a u128 ScVal to bigint. */
  protected decodeU128(val: xdr.ScVal): bigint {
    if (val.switch() !== xdr.ScValType.scvU128()) throw new Error("Expected u128");
    const u = val.u128();
    return BigInt(u.lo().toString()) + (BigInt(u.hi().toString()) << 64n);
  }

  /** Decode a u64 ScVal to bigint. */
  protected decodeU64(val: xdr.ScVal): bigint {
    if (val.switch() !== xdr.ScValType.scvU64()) throw new Error("Expected u64");
    return BigInt(val.u64().toString());
  }

  /** Decode a bool ScVal. */
  protected decodeBool(val: xdr.ScVal): boolean {
    if (val.switch() !== xdr.ScValType.scvBool()) throw new Error("Expected bool");
    return val.b();
  }

  /** Decode a string/symbol ScVal. */
  protected decodeString(val: xdr.ScVal): string {
    const t = val.switch();
    if (t === xdr.ScValType.scvString()) return val.str().toString();
    if (t === xdr.ScValType.scvSymbol()) return val.sym().toString();
    throw new Error("Expected string or symbol");
  }

  /** Encode an address arg. */
  protected encodeAddress(addr: string): xdr.ScVal {
    return new Address(addr).toScVal();
  }

  /** Encode a bigint as i128. */
  protected encodeI128(n: bigint): xdr.ScVal {
    return nativeToScVal(n, { type: "i128" });
  }

  /** Encode a bigint as u128. */
  protected encodeU128(n: bigint): xdr.ScVal {
    return nativeToScVal(n, { type: "u128" });
  }
}
