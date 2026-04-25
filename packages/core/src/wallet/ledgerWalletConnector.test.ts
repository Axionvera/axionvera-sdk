import { LedgerWalletConnector } from "./ledgerWalletConnector";

jest.mock("@ledgerhq/hw-transport-webusb", () => ({
  __esModule: true,
  default: {
    create: jest.fn(async () => ({ close: jest.fn(async () => undefined) })),
  },
}));

jest.mock("@ledgerhq/hw-app-str", () => ({
  __esModule: true,
  default: class StrAppMock {
    getPublicKey = jest.fn(async () => ({
      rawPublicKey: Buffer.alloc(32),
    }));
    signTransaction = jest.fn(async () => ({
      signature: Buffer.from("deadbeef", "hex"),
    }));
  },
}));

describe("LedgerWalletConnector", () => {
  it("gets a public key", async () => {
    const connector = new LedgerWalletConnector();
    const pk = await connector.getPublicKey();
    expect(typeof pk).toBe("string");
    expect(pk.length).toBeGreaterThan(0);
  });
});

