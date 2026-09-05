# Maintainer Integration Checklist

This checklist provides a step-by-step reference for maintainers performing real testnet integration of the Axionvera SDK with the deployed Network vault contract.

## Pre-Integration Requirements

### Environment Setup

- [ ] Secure environment variables configured (`.env` file, not committed)
- [ ] Real contract IDs obtained from Network deployment
- [ ] RPC endpoint URLs for testnet (and mainnet if applicable)
- [ ] Wallet extension(s) installed and tested (Freighter, Rabet, etc.)
- [ ] Stellar CLI tools installed for manual verification
- [ ] Testnet account funded with XLM for transaction fees

### Security Verification

- [ ] `.env` added to `.gitignore`
- [ ] No hardcoded secrets in source code
- [ ] `.env.example` created with placeholder values
- [ ] Secret management process documented
- [ ] Team members trained on secret handling
- [ ] Audit log access for sensitive operations

## Phase 1: Contract ID Handoff

### 1.1 Obtain Real Contract IDs

- [ ] Get deployed vault contract ID from Network team
- [ ] Verify contract ID format (starts with 'C' for contracts)
- [ ] Document contract source and deployment transaction hash
- [ ] Store contract ID in secure environment variable

```bash
# Add to .env (never commit)
VAULT_CONTRACT_ID="CAXIONVERA_REAL_CONTRACT_ID_1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

### 1.2 Update SDK Configuration

- [ ] Create configuration file for real contract IDs
- [ ] Update `AxionveraClient` initialization with real contract ID
- [ ] Test contract connectivity with read-only operations
- [ ] Verify contract methods match SDK expectations

```typescript
// Update from placeholder to real contract ID
const vault = new VaultContract({
  contractId: process.env.VAULT_CONTRACT_ID,
  invoker
});
```

### 1.3 Validate Contract Interface

- [ ] Run compatibility tests with real contract
- [ ] Compare actual contract methods with SDK expectations
- [ ] Update `schemas/network-vault-interface.fixture.json` if needed
- [ ] Document any interface discrepancies

```bash
# Test contract compatibility
npx vitest run packages/core/src/compatibility.test.ts
```

## Phase 2: RPC Configuration

### 2.1 Configure Real RPC Endpoints

- [ ] Obtain official Stellar Soroban RPC endpoints
- [ ] Test RPC endpoint connectivity
- [ ] Verify RPC method availability (`simulateTransaction`, `sendTransaction`)
- [ ] Configure network settings for testnet/mainnet

```bash
# Add to .env
AXIONVERA_RPC_URL="https://soroban-testnet.stellar.org"
AXIONVERA_NETWORK="testnet"
AXIONVERA_HORIZON_URL="https://horizon-testnet.stellar.org"
```

### 2.2 Implement Real RPC Transport

- [ ] Update `AxionveraClient` with real `FetchRpcTransport`
- [ ] Test RPC transport with health checks
- [ ] Implement error handling for RPC failures
- [ ] Add retry logic for transient failures

```typescript
const client = new AxionveraClient({ 
  network: 'testnet',
  rpcUrl: process.env.AXIONVERA_RPC_URL,
  transport: new FetchRpcTransport({
    url: process.env.AXIONVERA_RPC_URL,
    timeout: 30000
  })
});
```

### 2.3 Test RPC Integration

- [ ] Test `getHealth()` RPC call
- [ ] Test `getTransaction()` RPC call
- [ ] Verify network configuration retrieval
- [ ] Test error handling for invalid RPC calls

## Phase 3: Wallet Integration

### 3.1 Choose Wallet Provider(s)

- [ ] Select wallet provider(s) to support (Freighter, Rabet, etc.)
- [ ] Install wallet provider SDKs
- [ ] Test wallet extension installation
- [ ] Create test accounts with wallet extensions

### 3.2 Implement Real Wallet Connector

- [ ] Implement `WalletConnector` interface for chosen wallet
- [ ] Test wallet connection flow
- [ ] Test wallet disconnection flow
- [ ] Test wallet public key retrieval

```typescript
import { FreighterWallet } from '@stellar/freighter-api';

class RealWalletConnector implements WalletConnector {
  async connect() {
    const wallet = new FreighterWallet();
    const publicKey = await wallet.getPublicKey();
    return { publicKey, network: 'testnet' };
  }
  
  async disconnect() {
    // Implement disconnect logic
  }
  
  async isConnected() {
    // Check connection status
  }
  
  async signTransaction(xdr: string, options: SignOptions) {
    // Implement signing with real wallet
  }
}
```

### 3.3 Test Wallet Signing

- [ ] Test transaction signing with real wallet
- [ ] Test user rejection handling
- [ ] Test signing error handling
- [ ] Verify signature format and validity

### 3.4 Update React Integration

- [ ] Update `AxionveraProvider` to use real wallet connector
- [ ] Test React hooks with real wallet
- [ ] Update examples with real wallet integration
- [ ] Test wallet state management in React

## Phase 4: Transaction Submission

### 4.1 Implement Stellar Transaction Building

- [ ] Implement XDR assembly for Stellar transactions
- [ ] Add fee estimation logic
- [ ] Implement sequence number management
- [ ] Add transaction validation before signing

```typescript
// Implement real transaction building
async buildTransaction(operation: Operation) {
  const account = await this.getAccount(sourceAccount);
  const transaction = new TransactionBuilder(account, {
    fee: await this.estimateFee(operation),
    networkPassphrase: NETWORK_PASSPHRASE
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();
  
  return transaction.toXDR();
}
```

### 4.2 Implement Soroban Transaction Submission

- [ ] Implement `simulateTransaction` RPC call
- [ ] Implement `sendTransaction` RPC call
- [ ] Add transaction preparation with simulation results
- [ ] Handle Soroban-specific transaction format

```typescript
// Update SorobanContractInvoker for real submission
class SorobanContractInvoker implements ContractInvoker {
  async invoke(request: ContractInvokeRequest) {
    // 1. Build transaction
    const transaction = await this.buildTransaction(request);
    
    // 2. Simulate transaction
    const simulation = await this.simulateTransaction(transaction);
    
    // 3. Prepare transaction with simulation results
    const prepared = this.prepareTransaction(transaction, simulation);
    
    // 4. Sign transaction
    const signed = await this.signTransaction(prepared);
    
    // 5. Submit transaction
    const result = await this.sendTransaction(signed);
    
    return result;
  }
}
```

### 4.3 Test Transaction Submission

- [ ] Test deposit transaction submission
- [ ] Test withdraw transaction submission
- [ ] Test claim rewards transaction submission
- [ ] Test error handling for failed submissions
- [ ] Test fee bumping for congested network

### 4.4 Handle Submission Errors

- [ ] Implement retry logic for transient failures
- [ ] Handle insufficient balance errors
- [ ] Handle sequence number conflicts
- [ ] Handle network timeout errors
- [ ] Provide clear error messages to users

## Phase 5: Transaction Polling

### 5.1 Implement RPC-Based Transaction Lookup

- [ ] Implement `getTransaction` RPC call wrapper
- [ ] Add transaction status parsing logic
- [ ] Handle different transaction states
- [ ] Implement polling interval management

```typescript
// Implement built-in RPC lookup
async lookupTransaction(hash: string): Promise<TransactionResult> {
  const response = await this.rpc.sendTransaction(hash);
  return {
    hash: response.hash,
    status: this.parseStatus(response.status),
    ledger: response.ledger,
    error: response.error
  };
}
```

### 5.2 Update waitForTransaction Helper

- [ ] Add built-in RPC lookup option
- [ ] Keep custom lookup function support
- [ ] Update polling logic for real network conditions
- [ ] Add network-specific timeout defaults

```typescript
// Update waitForTransaction to support built-in lookup
const result = await waitForTransaction({
  hash: transactionHash,
  client, // Built-in RPC lookup
  interval: 1000,
  maxAttempts: 30
});
```

### 5.3 Test Transaction Polling

- [ ] Test successful transaction polling
- [ ] Test failed transaction polling
- [ ] Test timeout handling
- [ ] Test network interruption handling
- [ ] Test polling interval optimization

### 5.4 Update React Transaction Status Hook

- [ ] Update `useTransactionStatus` with built-in lookup
- [ ] Test React polling with real transactions
- [ ] Update examples with real polling behavior
- [ ] Handle polling errors in React components

## Phase 6: End-to-End Testing

### 6.1 Test Complete Integration Flow

- [ ] Test wallet connection → vault read → transaction execution → polling
- [ ] Test all vault operations (deposit, withdraw, claim rewards)
- [ ] Test error scenarios throughout the flow
- [ ] Test concurrent transaction handling
- [ ] Test network interruption recovery

### 6.2 Performance Testing

- [ ] Measure transaction submission latency
- [ ] Measure transaction confirmation time
- [ ] Test under network congestion conditions
- [ ] Optimize polling intervals based on real data
- [ ] Benchmark memory usage during operations

### 6.3 Security Testing

- [ ] Test transaction parameter validation
- [ ] Test for potential replay attacks
- [ ] Test authorization checks
- [ ] Test error message information leakage
- [ ] Verify no sensitive data in logs

### 6.4 User Experience Testing

- [ ] Test error message clarity
- [ ] Test loading states and progress indicators
- [ ] Test wallet permission requests
- [ ] Test transaction confirmation UX
- [ ] Gather feedback from beta testers

## Phase 7: Documentation Updates

### 7.1 Update Configuration Documentation

- [ ] Update `docs/configuration.md` with real RPC settings
- [ ] Document environment variable requirements
- [ ] Add troubleshooting for common configuration issues
- [ ] Update network configuration examples

### 7.2 Update Examples

- [ ] Create real wallet integration examples
- [ ] Update execution examples with real transaction flow
- [ ] Add troubleshooting examples for common issues
- [ ] Document real vs mock behavior differences

### 7.3 Update API Documentation

- [ ] Update TSDoc comments for real integration behavior
- [ ] Document maintainer-only parameters
- [ ] Add security warnings to sensitive functions
- [ ] Update return type documentation

### 7.4 Create Migration Guide

- [ ] Document changes from mock to real integration
- [ ] Provide migration steps for existing users
- [ ] Document breaking changes
- [ ] Update `MIGRATION_GUIDE.md` if needed

## Phase 8: Deployment Preparation

### 8.1 Pre-Deployment Checklist

- [ ] All tests passing (unit, integration, e2e)
- [ ] Security audit completed
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated and reviewed
- [ ] Examples tested and working
- [ ] Error handling comprehensive
- [ ] Monitoring and logging configured

### 8.2 Monitoring Setup

- [ ] Set up transaction success rate monitoring
- [ ] Set up error rate monitoring
- [ ] Set up performance monitoring
- [ ] Configure alerting for critical failures
- [ ] Set up log aggregation

### 8.3 Rollback Plan

- [ ] Document rollback procedure
- [ ] Test rollback process
- [ ] Identify rollback triggers
- [ ] Communicate rollback plan to team
- [ ] Prepare user communication for rollback

### 8.4 Mainnet Deployment

- [ ] Schedule deployment window
- [ ] Communicate deployment to users
- [ ] Perform final sanity checks
- [ ] Execute deployment
- [ ] Monitor for issues
- [ ] Be ready to rollback if needed

## Post-Deployment Monitoring

### Immediate Monitoring (First 24 Hours)

- [ ] Monitor transaction success rates
- [ ] Monitor error rates and types
- [ ] Monitor RPC endpoint performance
- [ ] Monitor wallet connection success rates
- [ ] Gather user feedback

### Ongoing Monitoring

- [ ] Weekly performance reviews
- [ ] Monthly security audits
- [ ] Quarterly dependency updates
- [ ] Regular user feedback collection
- [ ] Continuous improvement of UX

## Maintenance Tasks

### Regular Maintenance

- [ ] Weekly: Review error logs and fix issues
- [ ] Monthly: Update dependencies and test
- [ ] Quarterly: Security audit and updates
- [ ] As needed: Update compatibility fixtures

### Emergency Procedures

- [ ] Document emergency contact information
- [ ] Document emergency shutdown procedure
- [ ] Document emergency wallet rotation process
- [ ] Document emergency RPC endpoint failover

## References

### Documentation Links

- [Maintainer Handoff Guide](./maintainer-handoff.md) - Detailed integration guide
- [Transaction Signing Pipeline](./transaction-signing-pipeline.md) - Wallet signing details
- [SDK-to-Network Compatibility](./sdk-network-compatibility.md) - Interface compatibility
- [Configuration](./configuration.md) - Environment variable setup
- [Release Readiness](./release-readiness.md) - Pre-deployment validation

### Script References

- [Release Readiness Script](../scripts/release-readiness.js) - Validation script
- [Release Readiness Test](../scripts/test-release-readiness.js) - Script validation

### Example References

- [Mock Wallet Signing Pipeline](../examples/mock-wallet-signing-pipeline.ts) - Wallet signing example
- [Execution Examples](../examples/execution-examples.ts) - Transaction execution examples
- [React Vault Example](../examples/react-vault-example.tsx) - React integration example

### Schema References

- [Network Vault Interface](../schemas/network-vault-interface.fixture.json) - Contract interface fixture
- [Environment Variables Example](../.env.example) - Secure configuration template

## Security Reminders

### ⚠️ Critical Security Practices

- **NEVER** commit private keys, seed phrases, or wallet mnemonics
- **NEVER** commit real contract IDs for production deployments
- **NEVER** commit API keys or authentication tokens
- **ALWAYS** use environment variables for sensitive configuration
- **ALWAYS** validate all user inputs before processing
- **ALWAYS** use HTTPS for all network communications
- **ALWAYS** implement proper error handling without information leakage
- **ALWAYS** require user approval for transaction signing

### Secret Management

- Use `.env` files for local development (never commit)
- Use secure secret management for production (AWS Secrets Manager, etc.)
- Rotate secrets regularly
- Audit secret access logs
- Use principle of least privilege for API keys

---

**Remember**: This checklist is a guide. Adapt it to your specific deployment requirements and security policies. Always prioritize security and user experience in your integration decisions.
