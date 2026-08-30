import { AxionveraClient, FetchRpcTransport, type JsonRpcResponse } from '@axionvera/core';

/**
 * Example: Mocking RPC boundaries for offline testing.
 * 
 * This example demonstrates how to use a custom fetch implementation
 * to intercept and verify SDK outgoing requests to a Soroban RPC node.
 */
async function runExample() {
  const RPC_URL = 'https://soroban-testnet.stellar.org';
  
  // 1. Define a mock fetch function
  const mockFetch = async (url: string, init?: RequestInit): Promise<Response> => {
    console.log(`[MOCK FETCH] Intercepted request to: ${url}`);
    
    if (init?.body) {
      const body = JSON.parse(init.body as string);
      console.log(`[MOCK FETCH] Method: ${body.method}`);
      console.log(`[MOCK FETCH] Params:`, body.params);
      
      // Return a simulated success response for getTransaction
      if (body.method === 'getTransaction') {
        const response: JsonRpcResponse<any> = {
          jsonrpc: '2.0',
          id: body.id,
          result: {
            hash: body.params.hash,
            status: 'success',
            ledger: 12345
          }
        };
        
        return new Response(JSON.stringify(response), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        });
      }
    }
    
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      id: 0,
      error: { code: -32601, message: 'Method not found in mock' }
    }), { status: 200 });
  };

  // 2. Initialize the client with the mock transport
  const transport = new FetchRpcTransport(RPC_URL, mockFetch as any);
  const client = new AxionveraClient({ transport });

  // 3. Execute a call and verify behavior
  console.log('--- Executing getTransaction ---');
  const result = await client.getTransaction('d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8');
  
  console.log('--- Final Result ---');
  console.log(`Hash: ${result.hash}`);
  console.log(`Status: ${result.status}`);
  console.log(`Ledger: ${result.ledger}`);
}

// Only run if this script is executed directly
if (require.main === module) {
  runExample().catch(console.error);
}

export { runExample };
