import { 
  Account, 
  Keypair, 
  TransactionBuilder, 
  FeeBumpTransaction,
  Contract,
  nativeToScVal
} from "@stellar/stellar-sdk";
import { StellarClient } from "@axionvera/core";

describe("Transaction Serialization and Deserialization", () => {
  const networkPassphrase = "Test SDF Network ; September 2015";
  const client = new StellarClient({ network: "testnet" });

  test("should serialize and deserialize a regular transaction", () => {
    // Create a test transaction
    const sourceAccount = new Account("GB7TAYRUZQ6NFZRI3TEAVXWZDRDKKWRMVI4UYJNPRGJZEV3NUJECMDXL", "1");
    
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase
    })
      .addOperation(
        new Contract("CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C")
          .call("balance", nativeToScVal("token"))
      )
      .setTimeout(30)
      .build();

    // Serialize the transaction
    const serialized = client.serializeTransaction(tx);
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe("string");

    // Deserialize the transaction
    const deserializedTx = client.deserializeTransaction(serialized);
    expect(deserializedTx).toBeDefined();

    // Verify the hash matches
    const hashMatches = StellarClient.verifyTransactionHash(tx, deserializedTx);
    expect(hashMatches).toBe(true);
  });

  test("should serialize and deserialize a fee bump transaction", () => {
    // Create an inner transaction
    const sourceAccount = new Account("GB7TAYRUZQ6NFZRI3TEAVXWZDRDKKWRMVI4UYJNPRGJZEV3NUJECMDXL", "1");
    
    const innerTx = new TransactionBuilder(sourceAccount, {
      fee: "100",
      networkPassphrase
    })
      .addOperation(
        new Contract("CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C")
          .call("balance", nativeToScVal("token"))
      )
      .setTimeout(30)
      .build();

    // Create fee bump transaction
    const feeSource = Keypair.random();
    const feeBumpTx = new FeeBumpTransaction(
      feeSource.publicKey(),
      200,
      innerTx,
      networkPassphrase
    );

    // Serialize the fee bump transaction
    const serialized = client.serializeTransaction(feeBumpTx);
    expect(serialized).toBeDefined();
    expect(typeof serialized).toBe("string");

    // Deserialize the fee bump transaction
    const deserializedTx = client.deserializeTransaction(serialized);
    expect(deserializedTx).toBeDefined();

    // Verify the hash matches
    const hashMatches = StellarClient.verifyTransactionHash(feeBumpTx, deserializedTx);
    expect(hashMatches).toBe(true);
  });

  test("should throw error for invalid serialized data", () => {
    const invalidData = "invalid-base64-data";
    
    expect(() => {
      client.deserializeTransaction(invalidData);
    }).toThrow("Failed to deserialize transaction");
  });

  test("should throw error for missing required fields", () => {
    // Create invalid JSON with missing fields
    const invalidSerializedData = Buffer.from(JSON.stringify({
      xdr: "some-xdr-data"
      // Missing networkPassphrase
    })).toString('base64');

    expect(() => {
      client.deserializeTransaction(invalidSerializedData);
    }).toThrow("Invalid serialized transaction: missing required fields");
  });

  test("should preserve transaction metadata", () => {
    const sourceAccount = new Account("GB7TAYRUZQ6NFZRI3TEAVXWZDRDKKWRMVI4UYJNPRGJZEV3NUJECMDXL", "1");
    
    const tx = new TransactionBuilder(sourceAccount, {
      fee: "150",
      networkPassphrase
    })
      .addOperation(
        new Contract("CA3D5KRYM6CB7OWQ6TWYRR3Z4T7GNZLKERYNZGK5VLJQ4VJ7M2XDOF2C")
          .call("balance", nativeToScVal("token"))
      )
      .addMemo("Test memo")
      .setTimeout(60)
      .build();

    const serialized = client.serializeTransaction(tx);
    const deserializedTx = client.deserializeTransaction(serialized);

    // Verify key properties are preserved
    expect(deserializedTx.fee.toString()).toBe("150");
    expect(deserializedTx.memo?.value).toBe("Test memo");
    expect(deserializedTx.timeBounds?.maxTime).toBe("60");
    expect(deserializedTx.sourceAccount().accountId()).toBe("GB7TAYRUZQ6NFZRI3TEAVXWZDRDKKWRMVI4UYJNPRGJZEV3NUJECMDXL");
  });
});
