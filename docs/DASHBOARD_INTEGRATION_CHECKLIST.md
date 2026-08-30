# Dashboard Integration Checklist

This checklist guides the integration of the SDK into the Dashboard repo.

## 1. Environment Setup

### Required Environment Variables

```env
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=CD3...YOUR_VAULT_ADDRESS
NEXT_PUBLIC_FACTORY_CONTRACT_ADDRESS=CD3...YOUR_FACTORY_ADDRESS
NEXT_PUBLIC_WALLET_PROVIDER=freighter
NEXT_PUBLIC_ENABLE_MOCK=false
NEXT_PUBLIC_ENABLE_DEBUG=false

### Validation Checklist
□ All required environment variables are set
□ No hardcoded secrets in the codebase
□ .env.local is added to .gitignore

## 2. Mocked Mode

### Enable Mock Mode
```env
NEXT_PUBLIC_ENABLE_MOCK=true

### Validation Checklist
□ Mock mode is enabled via environment variable
□ Mock data covers all required fields
□ No network calls are made in mock mode


## 3. Testnet-Ready Mode
### Configure Testnet
```env
NEXT_PUBLIC_NETWORK=testnet
NEXT_PUBLIC_RPC_URL=https://soroban-testnet.stellar.org
NEXT_PUBLIC_PASSPHRASE=Test SDF Network ; September 2015
NEXT_PUBLIC_ENABLE_MOCK=false

### Validation Checklist
□ Testnet RPC URL is configured
□ Contract addresses are set correctly
□ Wallet integration works
□ Can read vault data from the contract
□ Can execute write actions
□ Transaction status is correctly displayed

## 4. Write Actions
### Validation Checklist
□ All write actions are implemented
□ Input validation is performed before submission
□ Signing works correctly
□ Submission to the network works
□ Transaction status is correctly tracked

## 5. Read Actions
### Validation Checklist
□ All read actions are implemented
□ Data is correctly parsed from contract responses
□ Data is cached appropriately
□ Loading states are displayed

## 6. Transaction Status Tracking
### Validation Checklist
□ Transaction status is correctly tracked
□ Status updates are displayed in real-time
□ Success and failure states are clearly shown
□ Transaction hash is displayed for reference

## 7. Maintainer-Only Live Validation
### Configure Live Mode
```env
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_RPC_URL=https://horizon.stellar.org
NEXT_PUBLIC_PASSPHRASE=Public Global Stellar Network ; September 2015
NEXT_PUBLIC_ENABLE_MOCK=false
NEXT_PUBLIC_MAINTAINER_MODE=true

### Validation Checklist
□ Maintainer mode is enabled via environment variable
□ Maintainer-only features are properly guarded
□ Live validation does not affect regular users

## 8. Mode Comparison
### Feature	       Mocked	Testnet	 Live
Network Connection	❌	✅	✅
Real Contract Calls	❌	✅	✅
Wallet Required	        ❌      ✅      ✅
Real Assets	        ❌      ❌	✅
Maintainer Features	❌	❌	✅

## 9. Success Criteria
□ All checklist items are completed
□ Mocked mode works perfectly
□ Testnet integration works
□ Read and write actions are functional
□ Transaction status is correctly displayed
□ All tests pass
