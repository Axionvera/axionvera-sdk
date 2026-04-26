import { rest } from 'msw';

// Soroban RPC URLs
const TESTNET_RPC_URL = 'https://soroban-testnet.stellar.org';
const MAINNET_RPC_URL = 'https://soroban-mainnet.stellar.org';

// Mock responses
const mockHealthResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    status: 'healthy',
    latestLedger: 12345,
    oldestLedger: 1,
    ledgerRetentionWindow: 12345
  }
};

const mockSimulateTransactionResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    minResourceFee: '100',
    events: [],
    results: [
      {
        auth: []
      }
    ],
    latestLedger: 12345
  }
};

const mockSendTransactionResponse = {
  jsonrpc: '2.0',
  id: 1,
  result: {
    hash: 'mock-transaction-hash-12345',
    status: 'PENDING',
    latestLedger: 12345,
    latestLedgerCloseTime: '1234567890'
  }
};

const handleRpcRequest = async (req: any, res: any, ctx: any) => {
  const body = await req.json();

  switch (body.method) {
    case 'getHealth':
      return res(
        ctx.status(200),
        ctx.json({
          ...mockHealthResponse,
          id: body.id
        })
      );
    case 'simulateTransaction':
      return res(
        ctx.status(200),
        ctx.json({
          ...mockSimulateTransactionResponse,
          id: body.id
        })
      );
    case 'sendTransaction':
      return res(
        ctx.status(200),
        ctx.json({
          ...mockSendTransactionResponse,
          id: body.id
        })
      );
    default:
      // If method is not handled, we can either bypass or return an error
      // Bypassing allows the request to proceed, but since it's a test, 
      // we might want to fail to ensure all RPC calls are mocked.
      // We'll return an error if it's an unrecognized RPC method.
      return res(
        ctx.status(400),
        ctx.json({
          jsonrpc: '2.0',
          id: body.id,
          error: {
            code: -32601,
            message: `Method not found: ${body.method}`
          }
        })
      );
  }
};

// Request handlers for JSON-RPC
export const handlers = [
  // Stellar Soroban RPC usually uses the root or /rpc path, some versions use / depending on the setup.
  // We'll intercept both root and /rpc to be safe.
  rest.post(TESTNET_RPC_URL, handleRpcRequest),
  rest.post(`${TESTNET_RPC_URL}/rpc`, handleRpcRequest),
  rest.post(`${TESTNET_RPC_URL}/`, handleRpcRequest),
  
  rest.post(MAINNET_RPC_URL, handleRpcRequest),
  rest.post(`${MAINNET_RPC_URL}/rpc`, handleRpcRequest),
  rest.post(`${MAINNET_RPC_URL}/`, handleRpcRequest),
];
