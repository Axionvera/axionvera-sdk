import { rest } from 'msw';

// Base URL for Stellar Soroban RPC
const STELLAR_TESTNET_URL = 'https://soroban-testnet.stellar.org';
const STELLAR_MAINNET_URL = 'https://soroban-mainnet.stellar.org';

// Mock data for testing
const mockHealthResponse = {
  status: 'healthy',
  version: '20.0.0'
};

const mockNetworkResponse = {
  friendbot_url: 'https://friendbot.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  protocol_version: 20
};

const mockLatestLedgerResponse = {
  id: '12345',
  protocol_version: 20,
  sequence: 123456
};

const mockAccountResponse = {
  id: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
  account_id: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
  sequence: 123456789,
  subentry_count: 0,
  last_modified_ledger: 123456,
  threshold: {
    low_threshold: 1,
    med_threshold: 2,
    high_threshold: 3
  },
  flags: {
    auth_required: false,
    auth_revocable: false,
    auth_immutable: false
  },
  balances: [
    {
      balance: '1000.0000000',
      asset_type: 'native'
    }
  ],
  signers: [
    {
      key: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
      weight: 1
    }
  ],
  data: {}
};

const mockTransactionResponse = {
  status: 'SUCCESS',
  latest_ledger: 123456,
  latest_ledger_close_time: 1640995200,
  oldest_ledger: 123450,
  oldest_ledger_close_time: 1640991600,
  application_order: 1
};

const mockTransactionSendResponse = {
  hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
  ledger: 123456,
  envelope_xdr: 'AAAAAgAAAAA...',
  result_xdr: 'AAAAAgAAAAA...',
  result_meta_xdr: 'AAAAAgAAAAA...'
};

// Error responses
const rateLimitResponse = {
  error: 'Rate limit exceeded',
  status: 429
};

const serverErrorResponse = {
  error: 'Internal server error',
  status: 500
};

// Request handlers for Stellar API endpoints
export const handlers = [
  // Health endpoint
  rest.get(`${STELLAR_TESTNET_URL}/health`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockHealthResponse)
    );
  }),

  rest.get(`${STELLAR_MAINNET_URL}/health`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockHealthResponse)
    );
  }),

  // Network endpoint
  rest.get(`${STELLAR_TESTNET_URL}`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockNetworkResponse)
    );
  }),

  rest.get(`${STELLAR_MAINNET_URL}`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockNetworkResponse)
    );
  }),

  // Latest ledger endpoint
  rest.get(`${STELLAR_TESTNET_URL}/ledgers/:sequence`, (req, res, ctx) => {
    const { sequence } = req.params;
    
    if (sequence === 'latest') {
      return res(
        ctx.status(200),
        ctx.json(mockLatestLedgerResponse)
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        ...mockLatestLedgerResponse,
        id: sequence,
        sequence: parseInt(sequence as string)
      })
    );
  }),

  rest.get(`${STELLAR_MAINNET_URL}/ledgers/:sequence`, (req, res, ctx) => {
    const { sequence } = req.params;
    
    if (sequence === 'latest') {
      return res(
        ctx.status(200),
        ctx.json(mockLatestLedgerResponse)
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json({
        ...mockLatestLedgerResponse,
        id: sequence,
        sequence: parseInt(sequence as string)
      })
    );
  }),

  // Account endpoint
  rest.get(`${STELLAR_TESTNET_URL}/accounts/:accountId`, (req, res, ctx) => {
    const { accountId } = req.params;
    
    // Return mock account data
    return res(
      ctx.status(200),
      ctx.json({
        ...mockAccountResponse,
        id: accountId,
        account_id: accountId
      })
    );
  }),

  rest.get(`${STELLAR_MAINNET_URL}/accounts/:accountId`, (req, res, ctx) => {
    const { accountId } = req.params;
    
    return res(
      ctx.status(200),
      ctx.json({
        ...mockAccountResponse,
        id: accountId,
        account_id: accountId
      })
    );
  }),

  // Transaction endpoint
  rest.get(`${STELLAR_TESTNET_URL}/transactions/:transactionId`, (req, res, ctx) => {
    const { transactionId } = req.params;
    
    return res(
      ctx.status(200),
      ctx.json({
        ...mockTransactionResponse,
        id: transactionId,
        hash: transactionId
      })
    );
  }),

  rest.get(`${STELLAR_MAINNET_URL}/transactions/:transactionId`, (req, res, ctx) => {
    const { transactionId } = req.params;
    
    return res(
      ctx.status(200),
      ctx.json({
        ...mockTransactionResponse,
        id: transactionId,
        hash: transactionId
      })
    );
  }),

  // Submit transaction endpoint
  rest.post(`${STELLAR_TESTNET_URL}/transactions`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockTransactionSendResponse)
    );
  }),

  rest.post(`${STELLAR_MAINNET_URL}/transactions`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json(mockTransactionSendResponse)
    );
  }),

  // Simulate transaction endpoint
  rest.post(`${STELLAR_TESTNET_URL}/simulate_transaction`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        transaction_data: 'AAAAAgAAAAA...',
        events: [],
        min_resource_fee: '100',
        results: [
          {
            auth: [
              {
                public_key: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
                signature_expires_in: 0,
                signature: 'AAAAAgAAAAA...'
              }
            ]
          }
        ],
        cost: {
          cpu_insns: 12345,
          mem_bytes: 67890
        },
        latest_ledger: 123456
      })
    );
  }),

  rest.post(`${STELLAR_MAINNET_URL}/simulate_transaction`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        transaction_data: 'AAAAAgAAAAA...',
        events: [],
        min_resource_fee: '100',
        results: [
          {
            auth: [
              {
                public_key: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
                signature_expires_in: 0,
                signature: 'AAAAAgAAAAA...'
              }
            ]
          }
        ],
        cost: {
          cpu_insns: 12345,
          mem_bytes: 67890
        },
        latest_ledger: 123456
      })
    );
  }),

  // Prepare transaction endpoint
  rest.post(`${STELLAR_TESTNET_URL}/prepare_transaction`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        transaction_data: 'AAAAAgAAAAA...',
        min_resource_fee: '100',
        latest_ledger: 123456
      })
    );
  }),

  rest.post(`${STELLAR_MAINNET_URL}/prepare_transaction`, (req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        transaction_data: 'AAAAAgAAAAA...',
        min_resource_fee: '100',
        latest_ledger: 123456
      })
    );
  }),

  // Error handlers for testing retry logic
  rest.get(`${STELLAR_TESTNET_URL}/health`, (req, res, ctx) => {
    if (req.headers.get('x-test-error') === 'rate-limit') {
      return res(
        ctx.status(429),
        ctx.json(rateLimitResponse)
      );
    }
    
    if (req.headers.get('x-test-error') === 'server-error') {
      return res(
        ctx.status(500),
        ctx.json(serverErrorResponse)
      );
    }
    
    return res(
      ctx.status(200),
      ctx.json(mockHealthResponse)
    );
  }),

  rest.get(`${STELLAR_TESTNET_URL}/accounts/:accountId`, (req, res, ctx) => {
    if (req.headers.get('x-test-error') === 'not-found') {
      return res(
        ctx.status(404),
        ctx.json({ error: 'Account not found' })
      );
    }
    
    const { accountId } = req.params;
    return res(
      ctx.status(200),
      ctx.json({
        ...mockAccountResponse,
        id: accountId,
        account_id: accountId
      })
    );
  }),
];

// Export individual handlers for consumers to use
export const healthHandler = rest.get(`${STELLAR_TESTNET_URL}/health`, (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json(mockHealthResponse)
  );
});

export const accountHandler = rest.get(`${STELLAR_TESTNET_URL}/accounts/:accountId`, (req, res, ctx) => {
  const { accountId } = req.params;
  return res(
    ctx.status(200),
    ctx.json({
      ...mockAccountResponse,
      id: accountId,
      account_id: accountId
    })
  );
});

export const transactionHandler = rest.get(`${STELLAR_TESTNET_URL}/transactions/:transactionId`, (req, res, ctx) => {
  const { transactionId } = req.params;
  return res(
    ctx.status(200),
    ctx.json({
      ...mockTransactionResponse,
      id: transactionId,
      hash: transactionId
    })
  );
});

export const submitTransactionHandler = rest.post(`${STELLAR_TESTNET_URL}/transactions`, (req, res, ctx) => {
  return res(
    ctx.status(200),
    ctx.json(mockTransactionSendResponse)
  );
});

// Error handlers for testing
export const rateLimitHandler = rest.get(`${STELLAR_TESTNET_URL}/health`, (req, res, ctx) => {
  return res(
    ctx.status(429),
    ctx.json(rateLimitResponse)
  );
});

export const serverErrorHandler = rest.get(`${STELLAR_TESTNET_URL}/health`, (req, res, ctx) => {
  return res(
    ctx.status(500),
    ctx.json(serverErrorResponse)
  );
});

export const notFoundHandler = rest.get(`${STELLAR_TESTNET_URL}/accounts/:accountId`, (req, res, ctx) => {
  return res(
    ctx.status(404),
    ctx.json({ error: 'Account not found' })
  );
});
