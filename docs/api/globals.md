[**Axionvera SDK v1.0.0**](README.md)

***

# Axionvera SDK v1.0.0

## Classes

- [AuthenticationError](classes/AuthenticationError.md)
- [AxionveraError](classes/AxionveraError.md)
- [AxionveraRPCError](classes/AxionveraRPCError.md)
- [BrowserWalletConnector](classes/BrowserWalletConnector.md)
- [ConcurrencyQueue](classes/ConcurrencyQueue.md)
- [ContractError](classes/ContractError.md)
- [FaucetClient](classes/FaucetClient.md)
- [FaucetRateLimitError](classes/FaucetRateLimitError.md)
- [InsecureNetworkError](classes/InsecureNetworkError.md)
- [InsufficientFundsError](classes/InsufficientFundsError.md)
- [InvalidSignatureError](classes/InvalidSignatureError.md)
- [NetworkError](classes/NetworkError.md)
- [RateLimitError](classes/RateLimitError.md)
- [RpcError](classes/RpcError.md)
- [SimulationError](classes/SimulationError.md)
- [SimulationFailedError](classes/SimulationFailedError.md)
- [StellarClient](classes/StellarClient.md)
- [TimeoutError](classes/TimeoutError.md)
- [TransactionError](classes/TransactionError.md)
- [ValidationError](classes/ValidationError.md)
- [Vault](classes/Vault.md)
- [WalletConnectionError](classes/WalletConnectionError.md)
- [WalletNotInstalledError](classes/WalletNotInstalledError.md)

## Interfaces

- [DepositParams](interfaces/DepositParams.md)
- [VaultConfig](interfaces/VaultConfig.md)
- [VaultInfo](interfaces/VaultInfo.md)
- [WalletConnector](interfaces/WalletConnector.md)
- [WithdrawParams](interfaces/WithdrawParams.md)

## Type Aliases

- [BuildBaseTransactionParams](type-aliases/BuildBaseTransactionParams.md)
- [StellarClientOptions](type-aliases/StellarClientOptions.md)

## Variables

- [accountHandler](variables/accountHandler.md)
- [handlers](variables/handlers.md)
- [healthHandler](variables/healthHandler.md)
- [notFoundHandler](variables/notFoundHandler.md)
- [rateLimitHandler](variables/rateLimitHandler.md)
- [server](variables/server.md)
- [serverErrorHandler](variables/serverErrorHandler.md)
- [submitTransactionHandler](variables/submitTransactionHandler.md)
- [transactionHandler](variables/transactionHandler.md)
- [VaultABI](variables/VaultABI.md)
- [VaultContract](variables/VaultContract.md)

## Functions

- [buildBaseTransaction](functions/buildBaseTransaction.md)
- [buildContractCallOperation](functions/buildContractCallOperation.md)
- [buildContractCallTransaction](functions/buildContractCallTransaction.md)
- [createConcurrencyControlledClient](functions/createConcurrencyControlledClient.md)
- [createHttpClientWithRetry](functions/createHttpClientWithRetry.md)
- [generatePayURI](functions/generatePayURI.md)
- [generateTransactionURI](functions/generateTransactionURI.md)
- [getDefaultRpcUrl](functions/getDefaultRpcUrl.md)
- [getNetworkPassphrase](functions/getNetworkPassphrase.md)
- [normalizeContractError](functions/normalizeContractError.md)
- [normalizeRpcError](functions/normalizeRpcError.md)
- [normalizeSimulationError](functions/normalizeSimulationError.md)
- [normalizeTransactionError](functions/normalizeTransactionError.md)
- [resolveNetworkConfig](functions/resolveNetworkConfig.md)
- [retry](functions/retry.md)
- [toAxionveraError](functions/toAxionveraError.md)
- [toScVal](functions/toScVal.md)

## References

### LocalKeypairWalletConnector

Renames and re-exports [VaultContract](variables/VaultContract.md)
