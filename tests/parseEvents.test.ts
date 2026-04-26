import { parseEvents, decodeSorobanSymbol, ParsedEvent } from "../src/utils/soroban";
import { xdr, nativeToScVal } from "@stellar/stellar-sdk";
import { decodeXdrBase64 } from "../src/utils/xdrCache";

/**
 * Helper to create a mock event from parsed data
 */
function createMockEvent(topics: xdr.ScVal[], data?: xdr.ScVal): any {
  return {
    type: "contract",
    topic: topics.map(t => {
      const envelope = xdr.TransactionEnvelope.envelopeTypeTx(
        new xdr.TransactionV2({ tx: t as any, signatures: [] })
      );
      return Buffer.from(envelope.toXDR()).toString("base64");
    }),
    data: data ? Buffer.from(data.toXDR()).toString("base64") : undefined,
    ledger: 1000,
    ledgerClosedAt: "2023-01-01T00:00:00Z",
    contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB"
  };
}

describe("parseEvents - Soroban Event Utilities", () => {
  describe("decodeSorobanSymbol", () => {
    it("should decode symbol ScVal", () => {
      const scVal = nativeToScVal("test_event");
      const result = decodeSorobanSymbol(scVal);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should return empty string for non-symbol types", () => {
      const scVal = nativeToScVal(123);
      const result = decodeSorobanSymbol(scVal);
      expect(result).toBe("");
    });

    it("should handle null gracefully", () => {
      const result = decodeSorobanSymbol(null as any);
      expect(result).toBe("");
    });
  });

  describe("parseEvents - Basic Parsing", () => {
    it("should parse empty events array", () => {
      const result = parseEvents([]);
      expect(result).toEqual([]);
    });

    it("should handle undefined events", () => {
      const result = parseEvents(undefined);
      expect(result).toEqual([]);
    });

    it("should parse events with symbol topics", () => {
      const eventName = nativeToScVal("transfer");
      const mockEvent = {
        type: "contract",
        topic: [eventName.toXDR("base64")],
        data: nativeToScVal(1000).toXDR("base64"),
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result).toHaveLength(1);
      expect(result[0].topics).toHaveLength(1);
      expect(result[0].eventName).toBeDefined();
    });

    it("should decode multiple topics", () => {
      const topic1 = nativeToScVal("transfer");
      const topic2 = nativeToScVal("from");
      const mockEvent = {
        type: "contract",
        topic: [topic1.toXDR("base64"), topic2.toXDR("base64")],
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].topics).toHaveLength(2);
    });

    it("should decode event data payload", () => {
      const topic = nativeToScVal("transfer");
      const data = nativeToScVal(5000);
      const mockEvent = {
        type: "contract",
        topic: [topic.toXDR("base64")],
        data: data.toXDR("base64"),
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].data).toBeDefined();
    });

    it("should set eventName from first topic", () => {
      const topic = nativeToScVal("burn");
      const mockEvent = {
        type: "contract",
        topic: [topic.toXDR("base64")],
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].eventName).toBeDefined();
    });

    it("should not set eventName if first topic is not a string", () => {
      const topic = nativeToScVal(123);
      const mockEvent = {
        type: "contract",
        topic: [topic.toXDR("base64")],
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].eventName).toBeUndefined();
    });
  });

  describe("parseEvents - Diagnostic Filtering", () => {
    it("should detect diagnostic events by type", () => {
      const mockEvent = {
        type: "diagnostic",
        topic: [],
        ledger: 1000
      };

      const result = parseEvents([mockEvent], { filterDiagnostic: false });
      expect(result).toHaveLength(1);
      expect(result[0].isDiagnostic).toBe(true);
    });

    it("should filter out diagnostic events when flag is true", () => {
      const contractEvent = {
        type: "contract",
        topic: [nativeToScVal("transfer").toXDR("base64")],
        ledger: 1000
      };
      const diagEvent = {
        type: "diagnostic",
        topic: [],
        ledger: 1001
      };

      const result = parseEvents([contractEvent, diagEvent], { filterDiagnostic: true });
      expect(result).toHaveLength(1);
      expect(result[0].isDiagnostic).toBe(false);
    });

    it("should keep diagnostic events when flag is false or undefined", () => {
      const mockEvent = {
        type: "diagnostic",
        topic: [],
        ledger: 1000
      };

      const result1 = parseEvents([mockEvent], { filterDiagnostic: false });
      const result2 = parseEvents([mockEvent]);
      
      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
    });

    it("should filter both contract and diagnostic events", () => {
      const contractEvents = [
        {
          type: "contract",
          topic: [nativeToScVal("transfer").toXDR("base64")],
          ledger: 1000
        },
        {
          type: "contract",
          topic: [nativeToScVal("approve").toXDR("base64")],
          ledger: 1001
        }
      ];
      const diagEvent = {
        type: "diagnostic",
        topic: [],
        ledger: 1002
      };

      const result = parseEvents([...contractEvents, diagEvent], { filterDiagnostic: true });
      expect(result).toHaveLength(2);
      expect(result.every(e => !e.isDiagnostic)).toBe(true);
    });
  });

  describe("parseEvents - Raw Data Inclusion", () => {
    it("should include raw event data when includeRaw is true", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("test").toXDR("base64")],
        ledger: 1000,
        contractId: "CAAAA...",
        customField: "custom_value"
      };

      const result = parseEvents([mockEvent], { includeRaw: true });
      expect(result[0].raw).toBeDefined();
      expect(result[0].raw.type).toBe("contract");
      expect(result[0].raw.customField).toBe("custom_value");
    });

    it("should not include raw event data when includeRaw is false", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("test").toXDR("base64")],
        ledger: 1000
      };

      const result = parseEvents([mockEvent], { includeRaw: false });
      expect(result[0].raw).toBeUndefined();
    });

    it("should not include raw event data by default", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("test").toXDR("base64")],
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].raw).toBeUndefined();
    });
  });

  describe("parseEvents - Error Handling", () => {
    it("should handle events with invalid XDR gracefully", () => {
      const mockEvent = {
        type: "contract",
        topic: ["invalid_base64"],
        ledger: 1000
      };

      // Should not throw
      const result = parseEvents([mockEvent]);
      expect(result).toHaveLength(1);
      // Invalid XDR will be returned as-is in topics
      expect(result[0].topics[0]).toBe("invalid_base64");
    });

    it("should handle events with missing topics array", () => {
      const mockEvent = {
        type: "contract",
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result).toHaveLength(1);
      expect(result[0].topics).toEqual([]);
    });

    it("should handle events with null topics", () => {
      const mockEvent = {
        type: "contract",
        topic: null,
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result).toHaveLength(1);
      expect(result[0].topics).toEqual([]);
    });

    it("should handle events with invalid data gracefully", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("test").toXDR("base64")],
        data: "invalid_data",
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result).toHaveLength(1);
      expect(result[0].data).toBeDefined();
    });
  });

  describe("parseEvents - Data Types", () => {
    it("should decode integer data", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("mint").toXDR("base64")],
        data: nativeToScVal(1000, { type: "i128" }).toXDR("base64"),
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].data).toBeDefined();
      expect(typeof result[0].data).toBe("number");
    });

    it("should decode boolean data", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("test").toXDR("base64")],
        data: nativeToScVal(true).toXDR("base64"),
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].data).toBe(true);
    });

    it("should handle null/void data", () => {
      const mockEvent = {
        type: "contract",
        topic: [nativeToScVal("test").toXDR("base64")],
        data: xdr.ScVal.scvVoid().toXDR("base64"),
        ledger: 1000
      };

      const result = parseEvents([mockEvent]);
      expect(result[0].data).toBeNull();
    });
  });

  describe("parseEvents - Multiple Events", () => {
    it("should parse multiple events correctly", () => {
      const events = [
        {
          type: "contract",
          topic: [nativeToScVal("transfer").toXDR("base64")],
          data: nativeToScVal(100).toXDR("base64"),
          ledger: 1000
        },
        {
          type: "contract",
          topic: [nativeToScVal("approve").toXDR("base64")],
          data: nativeToScVal(200).toXDR("base64"),
          ledger: 1001
        },
        {
          type: "contract",
          topic: [nativeToScVal("burn").toXDR("base64")],
          data: nativeToScVal(50).toXDR("base64"),
          ledger: 1002
        }
      ];

      const result = parseEvents(events);
      expect(result).toHaveLength(3);
      expect(result[0].eventName).toBeDefined();
      expect(result[1].eventName).toBeDefined();
      expect(result[2].eventName).toBeDefined();
    });

    it("should preserve event order", () => {
      const events = [
        {
          type: "contract",
          topic: [nativeToScVal("first").toXDR("base64")],
          ledger: 1000
        },
        {
          type: "contract",
          topic: [nativeToScVal("second").toXDR("base64")],
          ledger: 1001
        }
      ];

      const result = parseEvents(events);
      expect(result[0].topics[0]).toBe(result[0].eventName);
      expect(result[1].topics[0]).toBe(result[1].eventName);
    });
  });

  describe("parseEvents - Integration", () => {
    it("should handle real-world contract event structure", () => {
      const events = [
        {
          type: "contract",
          topic: [
            nativeToScVal("Transfer").toXDR("base64"),
            nativeToScVal("from").toXDR("base64"),
            nativeToScVal("to").toXDR("base64")
          ],
          data: nativeToScVal(1000000, { type: "i128" }).toXDR("base64"),
          ledger: 5000000,
          contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
        }
      ];

      const result = parseEvents(events, { filterDiagnostic: true, includeRaw: false });
      expect(result).toHaveLength(1);
      expect(result[0].topics).toHaveLength(3);
      expect(result[0].eventName).toBeDefined();
      expect(result[0].data).toBeDefined();
    });

    it("should work with filterDiagnostic and includeRaw together", () => {
      const events = [
        {
          type: "contract",
          topic: [nativeToScVal("transfer").toXDR("base64")],
          data: nativeToScVal(100).toXDR("base64"),
          ledger: 1000
        },
        {
          type: "diagnostic",
          topic: [],
          ledger: 1001
        }
      ];

      const result = parseEvents(events, { filterDiagnostic: true, includeRaw: true });
      expect(result).toHaveLength(1);
      expect(result[0].raw).toBeDefined();
      expect(result[0].isDiagnostic).toBe(false);
    });
  });
});
