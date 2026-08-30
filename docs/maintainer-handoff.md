# Maintainer Handoff Guide

This guide explains how the Axionvera SDK will connect to the deployed Network vault contract and separates contributor-safe work from maintainer-only actions.

## Overview

The SDK v2 is designed with an adapter-based architecture that allows contributors to work safely without access to real contract IDs, wallet secrets, or live network connections. Maintainers will later provide real contract IDs and perform real testnet validation.

## Architecture Overview

The SDK integration flow consists of four main components:

1. **SDK Configuration** - Network settings, RPC endpoints, contract IDs
2. **Wallet Signing** - Transaction preparation and wallet signature collection
3. **RPC Submission** - Submitting signed transactions to the Stellar network
4. **Transaction Polling** - Monitoring transaction status until confirmation

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   SDK Config    │ -> │ Wallet Signing   │ -> │ RPC Submission  │ -> │  Tx Polling     │
│  (Network/Contract)   │  (XDR + Signature)     │  (Stellar RPC)        │  (Status Check)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └─────────────────┘
        │                        │                        │                        │
        └────────────────────────┴────────────────────────┴────────────────────────┘
                                        Integration Flow
```

## Contributor-Safe Work

Contributors can safely work on the following areas without access to real contract IDs or secrets:

### 1. SDK Interface Development

- **Location**: `packages/core/src/`
- **Work**: Develop `VaultContract` methods, type definitions, and helper functions
- **Testing**: Use `MockWalletConnector` and `TestContractInvoker` for comprehensive testing
- **Safety**: No real network calls or secrets required

### 2. Transaction Schema Definition

- **Location**: `packages/core/src/execution.ts`
- **Work**: Define `SorobanExecutionRequest` and `SorobanExecutionResult` schemas
- **Testing**: Use the execution examples in `examples/execution-examples.ts`
- **Safety**: Schema validation works with mock data only

### 3. Compatibility Fixtures

- **Location**: `schemas/network-vault-interface.fixture.json`
- **Work**: Update interface expectations when Network contract changes
- **Testing**: Run `npx vitest run packages/core/src/compatibility.test.ts`
- **Safety**: No GitHub access or Network repository required

### 4. Mock Examples and Documentation

- **Location**: `examples/`, `docs/`
- **Work**: Create examples using `MockWalletConnector` and mock invokers
- **Testing**: All examples run without real network connections
- **Safety**: Demonstrates functionality without secrets

### 5. React Hook Development

- **Location**: `packages/react/src/`
- **Work**: Develop `useWallet`, `useVault`, and other React hooks
- **Testing**: Use `@testing-library/react` with mock providers
- **Safety**: No real wallet extensions or network calls required

## Maintainer-Only Actions

The following actions require maintainer access to real contract IDs, secrets, or testnet deployment:

### 1. Contract ID Handoff

**Current State**: The SDK uses placeholder contract IDs like `'YOUR_CONTRACT_ID'`

**Maintainer Action**: Replace placeholders with real deployed contract IDs

```typescript
// Before (contributor-safe)
const vault = new VaultContract({
  contractId: 'YOUR_CONTRACT_ID',
  invoker
});

// After (maintainer action)
const vault = new VaultContract({
  contractId: 'CAXIONVERA_REAL_CONTRACT_ID_1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  invoker
});
```

**Process**:
1. Obtain real contract ID from Network deployment
2. Update configuration files with real contract ID
3. Test connectivity to the deployed contract
4. Update documentation with real contract ID format

**Security**: Never commit real contract IDs to public repositories. Use environment variables or secure configuration management.

### 2. Real RPC Configuration

**Current State**: The SDK uses placeholder RPC URLs or mock transports

**Maintainer Action**: Configure real Stellar RPC endpoints

```typescript
// Before (contributor-safe)
const client = new AxionveraClient({ 
  network: 'testnet' 
  // Uses default mock transport
});

// After (maintainer action)
const client = new AxionveraClient({ 
  network: 'testnet',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  transport: new FetchRpcTransport({
    url: 'https://soroban-testnet.stellar.org'
  })
});
```

**Process**:
1. Obtain real RPC endpoint URLs for testnet/mainnet
2. Configure `AxionveraClient` with real transport
3. Test RPC connectivity and method availability
4. Update network configuration with real endpoints

**Security**: Use environment variables for RPC URLs. See `docs/configuration.md` for details.

### 3. Real Wallet Integration

**Current State**: The SDK uses `MockWalletConnector` for development

**Maintainer Action**: Integrate real wallet connectors (Freighter, Rabet, etc.)

```typescript
// Before (contributor-safe)
const wallet = new MockWalletConnector('GMOCK_PUBLIC_KEY');

// After (maintainer action)
import { FreighterWallet } from '@stellar/freighter-api';

const wallet = new FreighterWallet();
await wallet.connect();
```

**Process**:
1. Choose wallet provider(s) to support
2. Implement `WalletConnector` interface for real wallet
3. Test wallet connection and signing flow
4. Update examples with real wallet integration

**Security**: Never request or handle private keys directly. Use wallet extensions' secure signing APIs.

### 4. Real Transaction Submission

**Current State**: `SorobanContractInvoker` is a skeleton that validates requests but doesn't submit

**Maintainer Action**: Implement real Stellar transaction building and submission

```typescript
// Before (contributor-safe)
const invoker = new SorobanContractInvoker({ client });
// Currently validates request shape only

// After (maintainer action)
const invoker = new SorobanContractInvoker({ 
  client,
  enableRealSubmission: true,
  feeBump: 100 // Real fee handling
});
// Actually builds and submits Stellar transactions
```

**Process**:
1. Implement Stellar transaction building with XDR assembly
2. Add fee estimation and sequence number management
3. Implement real `simulateTransaction` and `sendTransaction` RPC calls
4. Test transaction submission on testnet
5. Handle submission errors and retries

**Security**: Validate all transaction parameters before submission. Never sign transactions without user approval.

### 5. Real Transaction Polling

**Current State**: `waitForTransaction` requires a custom lookup function

**Maintainer Action**: Implement built-in RPC-based transaction lookup

```typescript
// Before (contributor-safe)
const result = await waitForTransaction({
  hash: 'abc123',
  lookup: async (hash) => {
    // Custom lookup function required
    return { hash, status: 'success' };
  }
});

// After (maintainer action)
const result = await waitForTransaction({
  hash: 'abc123',
  client // Uses built-in RPC lookup
});
```

**Process**:
1. Implement RPC-based transaction status lookup
2. Add built-in polling with configurable intervals
3. Handle terminal states (success, failed, timeout)
4. Test polling behavior on testnet
5. Add error handling for network issues

**Security**: Use appropriate polling intervals to avoid rate limiting. Handle network failures gracefully.

## Integration Flow

### Complete Integration Example

Here's how the complete integration flow works when all maintainer actions are complete:

```typescript
import { 
  AxionveraClient, 
  VaultContract, 
  SorobanContractInvoker,
  waitForTransaction 
} from '@axionvera/core';
import { FreighterWallet } from '@stellar/freighter-api';

// 1. SDK Configuration (Maintainer: Real RPC endpoint)
const client = new AxionveraClient({ 
  network: 'testnet',
  rpcUrl: process.env.AXIONVERA_RPC_URL || 'https://soroban-testnet.stellar.org'
});

// 2. Wallet Connection (Maintainer: Real wallet)
const wallet = new FreighterWallet();
const { publicKey } = await wallet.connect();

// 3. Contract Setup (Maintainer: Real contract ID)
const invoker = new SorobanContractInvoker({ 
  client,
  enableRealSubmission: true 
});

const vault = new VaultContract({
  contractId: process.env.VAULT_CONTRACT_ID || 'CAXIONVERA_REAL_CONTRACT_ID',
  invoker
});

// 4. Transaction Execution (Maintainer: Real submission)
const result = await vault.deposit(publicKey, 100n);

// 5. Transaction Polling (Maintainer: Real RPC lookup)
const finalResult = await waitForTransaction({
  hash: result.hash,
  client // Built-in RPC lookup
});

console.log('Transaction confirmed:', finalResult);
```

## Security Guidelines

### ⚠️ CRITICAL: Never Commit Secrets

**DO NOT EVER COMMIT:**
- Private keys or seed phrases
- Wallet mnemonic phrases
- API keys or authentication tokens
- Real contract IDs for production deployments
- Personal wallet addresses or secrets

**INSTEAD:**
- Use environment variables for sensitive configuration
- Reference secrets documentation in commit messages
- Use `.env.example` files to show required variables
- Document secret management in maintainer guides

### Environment Variable Pattern

See [`.env.example`](../.env.example) for the complete template. The pattern is:

```bash
# .env.example (Safe to commit)
AXIONVERA_RPC_URL="https://soroban-testnet.stellar.org"
AXIONVERA_NETWORK="testnet"
VAULT_CONTRACT_ID="YOUR_CONTRACT_ID"

# .env (Never commit - use .gitignore)
AXIONVERA_RPC_URL="https://real-endpoint.example.com"
AXIONVERA_NETWORK="testnet"
VAULT_CONTRACT_ID="CAXIONVERA_REAL_CONTRACT_ID_1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

### Security Checklist

- [ ] All secrets are in environment variables
- [ ] `.env` files are in `.gitignore`
- [ ] No hardcoded credentials in source code
- [ ] Real contract IDs are not committed
- [ ] API keys are rotated regularly
- [ ] Wallet signing only through secure extensions
- [ ] Transactions require user approval
- [ ] RPC endpoints use HTTPS
- [ ] Error messages don't leak sensitive data

## Testing Strategy

### Contributor-Safe Testing

Contributors should focus on:

1. **Unit Tests**: Test individual functions with mock data
2. **Integration Tests**: Test components with `MockWalletConnector`
3. **Schema Tests**: Validate request/response schemas
4. **Compatibility Tests**: Check interface compatibility with fixtures

```bash
# Contributor-safe test commands
npm run lint
npm run typecheck
npm run build
npx vitest run
node scripts/release-readiness.js --dry-run
```

### Maintainer Testing

Maintainers should additionally perform:

1. **Real Contract Tests**: Test against deployed contract
2. **Wallet Integration Tests**: Test with real wallet extensions
3. **RPC Integration Tests**: Test real RPC method calls
4. **End-to-End Tests**: Test complete transaction flow on testnet

```bash
# Maintainer-only test commands
npm run release-readiness  # Full validation including quality commands
# Manual testnet validation
# Real wallet connection tests
# Live transaction submission tests
```

## References and Resources

### Documentation

- **Transaction Signing Pipeline**: [docs/transaction-signing-pipeline.md](./transaction-signing-pipeline.md)
- **SDK-to-Network Compatibility**: [docs/sdk-network-compatibility.md](./sdk-network-compatibility.md)
- **Configuration**: [docs/configuration.md](./configuration.md)
- **Release Readiness**: [docs/release-readiness.md](./release-readiness.md)
- **Maintainer Checklist**: [docs/maintainer-checklist.md](./maintainer-checklist.md)

### Examples

- **Mock Wallet Signing Pipeline**: [examples/mock-wallet-signing-pipeline.ts](../examples/mock-wallet-signing-pipeline.ts)
- **Execution Examples**: [examples/execution-examples.ts](../examples/execution-examples.ts)
- **React Vault Example**: [examples/react-vault-example.tsx](../examples/react-vault-example.tsx)
- **SDK Network Compatibility**: [examples/sdk-network-compatibility-example.ts](../examples/sdk-network-compatibility-example.ts)

### Schemas

- **Network Vault Interface**: [schemas/network-vault-interface.fixture.json](../schemas/network-vault-interface.fixture.json)

### Scripts

- **Release Readiness Check**: [scripts/release-readiness.js](../scripts/release-readiness.js)
- **Release Readiness Test**: [scripts/test-release-readiness.js](../scripts/test-release-readiness.js)

## Handoff Checklist

When transitioning from contributor-safe development to maintainer-led integration:

### Pre-Integration (Contributor-Safe)

- [ ] All unit tests pass with mocks
- [ ] Compatibility fixtures are up to date
- [ ] Documentation is complete and accurate
- [ ] Examples work with `MockWalletConnector`
- [ ] Release readiness check passes (dry-run mode)
- [ ] No hardcoded secrets or credentials in code

### Integration Phase (Maintainer-Led)

- [ ] Real contract IDs obtained and secured
- [ ] RPC endpoints configured and tested
- [ ] Wallet integration implemented and tested
- [ ] Real transaction submission implemented
- [ ] Transaction polling with RPC lookup implemented
- [ ] End-to-end tests on testnet pass
- [ ] Security audit completed
- [ ] Documentation updated with real integration details

### Post-Integration

- [ ] Monitor testnet transaction success rates
- [ ] Collect performance metrics
- [ ] Gather user feedback on wallet integration
- [ ] Update compatibility fixtures based on real contract behavior
- [ ] Document any deviations from expected behavior
- [ ] Plan mainnet deployment strategy

## Troubleshooting

### Common Integration Issues

**Issue**: Contract method not found
- **Cause**: Contract ID mismatch or contract not deployed
- **Solution**: Verify contract ID and deployment status

**Issue**: Wallet signing fails
- **Cause**: Wallet not connected or user rejected
- **Solution**: Check wallet connection state and user permissions

**Issue**: RPC submission fails
- **Cause**: Invalid transaction format or insufficient fees
- **Solution**: Validate transaction parameters and fee estimation

**Issue**: Transaction polling times out
- **Cause**: Network congestion or incorrect transaction hash
- **Solution**: Increase polling timeout and verify transaction hash

## Support and Contact

For maintainer-specific integration issues:
- Review the troubleshooting section above
- Check Stellar Soroban documentation
- Consult Network contract documentation
- Contact the SDK maintainers through official channels

---

**Remember**: The separation between contributor-safe and maintainer-only work is intentional. This allows broad contribution while ensuring security and reliability of real network integrations.
