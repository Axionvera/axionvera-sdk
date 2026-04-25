import { StellarClient } from "../src/client/stellarClient";

describe("StellarClient Custom Logger Integration", () => {
  it("should use custom logger for internal SDK operations", async () => {
    const mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const client = new StellarClient({
      network: "testnet",
      logger: mockLogger,
      logLevel: "debug",
    });

    // We don't need to call getHealth if we just want to see initialization logs
    expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining("Initializing StellarClient"));
  });
});
