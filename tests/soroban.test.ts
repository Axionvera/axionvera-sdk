import { xdr, nativeToScVal } from "@stellar/stellar-sdk";
import { decodeSorobanSymbol, parseEvents } from "../src/utils/soroban";

describe("Soroban utilities", () => {
  describe("decodeSorobanSymbol", () => {
    test("decodes a simple symbol", () => {
      const scVal = xdr.ScVal.scvSymbol("transfer");
      expect(decodeSorobanSymbol(scVal)).toBe("transfer");
    });

    test("decodes a symbol with underscores", () => {
      const scVal = xdr.ScVal.scvSymbol("increase_allowance");
      expect(decodeSorobanSymbol(scVal)).toBe("increase_allowance");
    });

    test("handles an empty symbol", () => {
      const scVal = xdr.ScVal.scvSymbol("");
      expect(decodeSorobanSymbol(scVal)).toBe("");
    });

    test("handles maximum length symbol (32 chars)", () => {
      const longSymbol = "a".repeat(32);
      const scVal = xdr.ScVal.scvSymbol(longSymbol);
      expect(decodeSorobanSymbol(scVal)).toBe(longSymbol);
    });

    test("returns empty string for non-symbol types", () => {
      const scVal = xdr.ScVal.scvVoid();
      expect(decodeSorobanSymbol(scVal)).toBe("");
    });

    test("falls back to string if it is scvString", () => {
      const scVal = nativeToScVal("hello", { type: "string" });
      expect(decodeSorobanSymbol(scVal)).toBe("hello");
    });
  });

  describe("parseEvents", () => {
    test("parses raw events and decodes topics", () => {
      const transferSymbolXdr = xdr.ScVal.scvSymbol("transfer").toXDR("base64");
      const fromSymbolXdr = xdr.ScVal.scvSymbol("from").toXDR("base64");
      
      const rawEvents = [
        {
          id: "1",
          topic: [transferSymbolXdr, fromSymbolXdr],
          value: "some_value_xdr",
          ledger: 100
        }
      ];

      const parsed = parseEvents(rawEvents);
      expect(parsed[0].topicNames).toEqual(["transfer", "from"]);
      expect(parsed[0].eventName).toBe("transfer");
    });

    test("handles non-symbol topics gracefully", () => {
      const numXdr = xdr.ScVal.scvI32(123).toXDR("base64");
      const rawEvents = [
        {
          id: "2",
          topic: [numXdr],
          value: "value"
        }
      ];

      const parsed = parseEvents(rawEvents);
      expect(parsed[0].topicNames[0]).toBe(numXdr); // Should keep as XDR if not symbol
    });

    test("handles invalid XDR topics gracefully", () => {
      const rawEvents = [
        {
          id: "3",
          topic: ["not-base64-xdr"],
          value: "value"
        }
      ];

      const parsed = parseEvents(rawEvents);
      expect(parsed[0].topicNames[0]).toBe("not-base64-xdr");
    });
  });
});
