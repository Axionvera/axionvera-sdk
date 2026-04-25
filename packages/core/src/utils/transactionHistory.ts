/**
 * Transaction history utilities for querying and parsing user transactions.
 */

import { rpc } from "@stellar/stellar-sdk";

/**
 * Supported transaction action types.
 */
export type TransactionActionType =
    | "vault_deposit"
    | "vault_withdraw"
    | "claim_rewards"
    | "unknown";

/**
 * Parsed transaction history entry.
 */
export type TransactionHistoryEntry = {
    /** Transaction hash */
    hash: string;
    /** Timestamp of the transaction */
    timestamp: string;
    /** Action type (e.g., "vault_deposit", "vault_withdraw") */
    action: TransactionActionType;
    /** Amount involved in the transaction (if applicable) */
    amount?: bigint;
    /** Contract ID involved (if applicable) */
    contractId?: string;
    /** Transaction status */
    status: "success" | "failed" | "pending";
    /** Raw transaction data */
    raw: any;
};

/**
 * Options for fetching transaction history.
 */
export type FetchTransactionHistoryOptions = {
    /** Maximum number of transactions to return (default: 50) */
    limit?: number;
    /** Cursor for pagination */
    cursor?: string;
    /** Filter by action type */
    actionType?: TransactionActionType;
    /** Custom indexer URL for richer history data */
    customIndexerUrl?: string;
};

/**
 * Result of fetching transaction history.
 */
export type TransactionHistoryResult = {
    /** Array of transaction history entries */
    transactions: TransactionHistoryEntry[];
    /** Cursor for fetching next page */
    nextCursor?: string;
    /** Whether there are more transactions available */
    hasMore: boolean;
};

/**
 * Parses a contract method name to determine the action type.
 * @param method - The contract method name
 * @returns The action type
 */
function parseActionType(method: string): TransactionActionType {
    const methodLower = method.toLowerCase();

    if (methodLower.includes("deposit")) {
        return "vault_deposit";
    }
    if (methodLower.includes("withdraw")) {
        return "vault_withdraw";
    }
    if (methodLower.includes("claim") && methodLower.includes("reward")) {
        return "claim_rewards";
    }

    return "unknown";
}

/**
 * Parses a transaction to extract relevant information.
 * @param tx - The transaction to parse
 * @returns Parsed transaction history entry
 */
export function parseTransaction(tx: any): TransactionHistoryEntry {
    const hash = tx.hash || tx.id || "";
    const timestamp = tx.created_at || new Date().toISOString();
    const status = tx.successful ? "success" : (tx.status === "NOT_FOUND" ? "pending" : "failed");

    // Try to extract action type from operations
    let action: TransactionActionType = "unknown";
    let amount: bigint | undefined;
    let contractId: string | undefined;

    if (tx.operations && Array.isArray(tx.operations)) {
        const operation = tx.operations[0];
        if (operation) {
            action = parseActionType(operation.name || operation.type || "");

            // Try to extract amount from operation arguments
            if (operation.args && Array.isArray(operation.args)) {
                const firstArg = operation.args[0];
                if (typeof firstArg === "bigint") {
                    amount = firstArg;
                } else if (typeof firstArg === "number") {
                    amount = BigInt(firstArg);
                }
            }

            contractId = operation.contract_id || operation.contractId;
        }
    }

    const entry: TransactionHistoryEntry = {
        hash,
        timestamp,
        action,
        status,
        raw: tx
    };

    if (amount !== undefined) {
        entry.amount = amount;
    }
    if (contractId !== undefined) {
        entry.contractId = contractId;
    }

    return entry;
}

/**
 * Filters transaction history by action type.
 * @param transactions - Array of transactions to filter
 * @param actionType - The action type to filter by
 * @returns Filtered transactions
 */
export function filterByActionType(
    transactions: TransactionHistoryEntry[],
    actionType: TransactionActionType
): TransactionHistoryEntry[] {
    if (actionType === "unknown") {
        return transactions;
    }
    return transactions.filter(tx => tx.action === actionType);
}

/**
 * Sorts transactions in reverse chronological order (newest first).
 * @param transactions - Array of transactions to sort
 * @returns Sorted transactions
 */
export function sortByTimestamp(transactions: TransactionHistoryEntry[]): TransactionHistoryEntry[] {
    return [...transactions].sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
    });
}
