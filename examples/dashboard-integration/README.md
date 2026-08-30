# Dashboard Integration Example

## Setup

1. Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local

2. Fill in the required environment variables.

3. Install dependencies: npm install

## Running the Example

### Mocked Mode
NEXT_PUBLIC_ENABLE_MOCK=true npm run dev

### Testnet Mode
NEXT_PUBLIC_ENABLE_MOCK=false npm run dev

### Maintainer Mode
NEXT_PUBLIC_MAINTAINER_MODE=true npm run dev

## Features Demonstrated
- Wallet connection (Freighter)

- Vault data reading

- Deposit/withdraw actions

- Transaction status tracking

- Health factor calculation

- Error handlin
