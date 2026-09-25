# Campaign SDK

## Overview

The Axionvera Campaign SDK provides typed Core and React APIs for interacting with
the Axionvera Campaign Soroban contract.

The integration covers:

- Campaign state reads
- Campaign lifecycle writes
- Wallet signing and transaction submission
- Campaign-specific contract errors
- Typed Campaign event decoding
- Live RPC event retrieval and pagination
- React read and write hooks
- Higher-level Campaign helper utilities

The SDK keeps contract interaction, wallet signing, event decoding, and React state
management separated so applications can use only the layers they need.

## Packages

Campaign functionality is available from:

~~~ts
import {
  CampaignContract,
  StellarCampaignReader,
  StellarCampaignWriter,
  StellarCampaignEventReader,
} from '@axionvera/core';
~~~

React applications can also use:

~~~ts
import {
  useCampaign,
  useCampaignWriter,
} from '@axionvera/react';
~~~

## Contract Interface Coverage

The SDK covers all 21 public Campaign contract methods.

### Read Methods

| Contract method | SDK method |
|---|---|
| `get_campaign` | `getCampaign` |
| `get_activation_rule` | `getActivationRule` |
| `is_verifier` | `isVerifier` |
| `claimable_reward` | `claimableReward` |
| `agent_total_earned` | `agentTotalEarned` |
| `available_unused_funds` | `availableUnusedFunds` |
| `is_initialized` | `isInitialized` |
| `protocol_admin` | `protocolAdmin` |
| `next_campaign_id` | `nextCampaignId` |

### Write Methods

| Contract method | Core live writer |
|---|---|
| `initialize` | `prepareInitialize` |
| `create_campaign` | `prepareCreateCampaign` |
| `fund_campaign` | `prepareFundCampaign` |
| `add_activation_rule` | `prepareAddActivationRule` |
| `add_verifier` | `prepareAddVerifier` |
| `remove_verifier` | `prepareRemoveVerifier` |
| `pause_campaign` | `preparePauseCampaign` |
| `resume_campaign` | `prepareResumeCampaign` |
| `close_campaign` | `prepareCloseCampaign` |
| `withdraw_unused_funds` | `prepareWithdrawUnusedFunds` |
| `verify_and_allocate_reward` | `prepareVerifyAndAllocateReward` |
| `claim_reward` | `prepareClaimReward` |

## Campaign Reads

Use `StellarCampaignReader` for direct read-only Soroban calls.

~~~ts
import {
  StellarCampaignReader,
} from '@axionvera/core';

const reader = new StellarCampaignReader({
  contractId:
    process.env.AXIONVERA_CAMPAIGN_CONTRACT_ID!,
  sourcePublicKey: 'G...',
});

const initialized =
  await reader.isInitialized();

const admin =
  await reader.protocolAdmin();

const nextId =
  await reader.nextCampaignId();

const campaign =
  await reader.getCampaign(1n);

const rule =
  await reader.getActivationRule(
    1n,
    'purchase_verified',
  );

const verifier =
  await reader.isVerifier(
    1n,
    'G...',
  );

const claimable =
  await reader.claimableReward(
    1n,
    'G...',
  );

const earned =
  await reader.agentTotalEarned(
    1n,
    'G...',
  );

const unused =
  await reader.availableUnusedFunds(1n);
~~~

Campaign IDs accept `bigint`, `number`, or `string` through `CampaignIdInput`.

## Campaign Writes

`StellarCampaignWriter` separates transaction preparation from wallet signing and
submission.

~~~ts
import {
  StellarCampaignWriter,
  requestWalletSignature,
  type WalletConnector,
} from '@axionvera/core';

const wallet: WalletConnector =
  /* your WalletConnector */;

const connection =
  await wallet.connect();

const writer =
  new StellarCampaignWriter({
    contractId:
      process.env.AXIONVERA_CAMPAIGN_CONTRACT_ID!,
    sourcePublicKey:
      connection.publicKey,
  });

const prepared =
  await writer.prepareFundCampaign({
    campaignId: 1n,
    amount: 100_000_000n,
  });

const signed =
  await requestWalletSignature({
    wallet,
    request: prepared,
  });

const result =
  await writer.submitSignedTransaction(
    signed.signedXdr,
  );

console.log(result.status);
~~~

This keeps private keys and provider-specific wallet behaviour outside the Campaign
contract layer.

### Create a Campaign

~~~ts
const prepared =
  await writer.prepareCreateCampaign({
    admin: connection.publicKey,
    rewardToken: 'C...',
    name: 'Referral Campaign',
    startTime: 1_790_000_000n,
    endTime: 1_791_000_000n,
    perAgentCap: 30_000_000n,
  });
~~~

### Add an Activation Rule

~~~ts
await writer.prepareAddActivationRule({
  campaignId: 1n,
  milestone: 'purchase_verified',
  rewardAmount: 10_000_000n,
});
~~~

### Add or Remove a Verifier

~~~ts
await writer.prepareAddVerifier({
  campaignId: 1n,
  verifier: 'G...',
});

await writer.prepareRemoveVerifier({
  campaignId: 1n,
  verifier: 'G...',
});
~~~

### Allocate a Reward

~~~ts
await writer.prepareVerifyAndAllocateReward({
  campaignId: 1n,
  verifier: 'G...',
  agent: 'G...',
  merchantRef: 'order-001',
  milestone: 'purchase_verified',
});
~~~

### Claim a Reward

~~~ts
await writer.prepareClaimReward({
  campaignId: 1n,
  agent: 'G...',
});
~~~

### Pause, Resume, Close, and Withdraw

~~~ts
await writer.preparePauseCampaign({
  campaignId: 1n,
});

await writer.prepareResumeCampaign({
  campaignId: 1n,
});

await writer.prepareCloseCampaign({
  campaignId: 1n,
});

await writer.prepareWithdrawUnusedFunds({
  campaignId: 1n,
  amount: 90_000_000n,
});
~~~

## Campaign Accounting

The available unused balance is:

~~~text
funded - allocated - withdrawn
~~~

Claims reduce claimable rewards and increase claimed accounting, but they do not
restore funds to the unused balance.

A reward that has already been allocated remains claimable after a campaign is
paused, closed, or reaches its end time.

## Activation Window

Reward allocation is valid only while:

~~~text
start_time <= ledger timestamp < end_time
~~~

The end time is exclusive.

## Campaign Helpers

### Campaign Snapshot

~~~ts
import {
  getCampaignSnapshot,
} from '@axionvera/core';

const snapshot =
  await getCampaignSnapshot(
    campaignContract,
    1n,
  );

console.log(snapshot.campaign);
console.log(snapshot.availableUnusedFunds);
~~~

### Agent Reward Summary

~~~ts
import {
  getAgentRewardSummary,
} from '@axionvera/core';

const summary =
  await getAgentRewardSummary(
    campaignContract,
    1n,
    'G...',
  );

console.log(summary.claimableReward);
console.log(summary.totalEarned);
~~~

## Campaign Errors

Campaign contract failures are normalized into `CampaignContractError`.

~~~ts
import {
  CampaignContractError,
} from '@axionvera/core';

try {
  await campaign.claimReward(
    1n,
    'G...',
  );
} catch (error) {
  if (
    error instanceof CampaignContractError
  ) {
    console.error(
      error.contractCode,
      error.contractErrorName,
    );
  }
}
~~~

The SDK maps all 27 deployed Campaign contract error codes.

| Code | Error |
|---:|---|
| 1 | `AlreadyInitialized` |
| 2 | `NotInitialized` |
| 3 | `InvalidTimeRange` |
| 4 | `InvalidCap` |
| 5 | `CampaignNotFound` |
| 6 | `CampaignIdOverflow` |
| 7 | `InvalidAmount` |
| 8 | `CampaignNotActive` |
| 9 | `ArithmeticOverflow` |
| 10 | `InvalidRewardAmount` |
| 11 | `RuleAlreadyExists` |
| 12 | `RuleNotFound` |
| 13 | `VerifierAlreadyExists` |
| 14 | `VerifierNotFound` |
| 15 | `UnauthorizedVerifier` |
| 16 | `RuleDisabled` |
| 17 | `DuplicateActivation` |
| 18 | `InsufficientCampaignFunds` |
| 19 | `AgentCapExceeded` |
| 20 | `NothingToClaim` |
| 21 | `InvalidAccountingState` |
| 22 | `CampaignNotPaused` |
| 23 | `CampaignAlreadyClosed` |
| 24 | `CampaignNotClosed` |
| 25 | `InsufficientUnusedFunds` |
| 26 | `CampaignNotStarted` |
| 27 | `CampaignEnded` |

## Campaign Events

The SDK defines 12 typed Campaign event variants:

~~~text
init
created
funded
rule_added
paused
resumed
closed
unused_withdraw
verifier_added
verifier_removed
reward_allocated
reward_claimed
~~~

Use `decodeCampaignEvent()` when you already have Soroban event XDR:

~~~ts
import {
  decodeCampaignEvent,
} from '@axionvera/core';

const decoded =
  decodeCampaignEvent({
    contractId,
    topics,
    data,
    transactionHash,
    ledger,
    raw,
  });
~~~

The decoder returns a typed `CampaignEvent` or `undefined` when the event does not
match a known Campaign event shape.

## Live Campaign Events

Use `StellarCampaignEventReader` to fetch and decode Campaign events directly from
Stellar RPC.

The event reader does not require a source account because `getEvents` is an RPC
history query rather than a contract simulation.

### Ledger Range

~~~ts
import {
  StellarCampaignEventReader,
} from '@axionvera/core';

const eventReader =
  new StellarCampaignEventReader({
    contractId:
      process.env.AXIONVERA_CAMPAIGN_CONTRACT_ID!,
  });

const page =
  await eventReader.getEvents({
    startLedger: 4_850_000,
    endLedger: 4_860_000,
    limit: 100,
  });

console.log(page.events);
console.log(page.cursor);
~~~

### Cursor Pagination

Ledger-range and cursor pagination modes are intentionally separate.

~~~ts
const nextPage =
  await eventReader.getEvents({
    cursor: page.cursor,
    limit: 100,
  });
~~~

Do not combine `cursor` with `startLedger` or `endLedger`.

### Unknown Events

Unknown or future Campaign events are not silently discarded.

~~~ts
console.log(page.events);
console.log(page.unrecognizedEvents);
~~~

`events` contains successfully decoded Campaign events.

`unrecognizedEvents` contains the adapted RPC event data for events that the current
SDK version does not recognize.

### Retention Metadata

Each page also exposes RPC retention information:

~~~ts
page.oldestLedger;
page.latestLedger;
page.oldestLedgerCloseTime;
page.latestLedgerCloseTime;
~~~

Applications should not assume that Stellar RPC retains event history indefinitely.

## React Reads

`useCampaign` provides all nine Campaign read methods plus the two higher-level
helpers.

~~~tsx
import {
  useCampaign,
} from '@axionvera/react';

function CampaignStatus() {
  const campaign =
    useCampaign({
      contractId: 'C...',
      invoker,
    });

  const load =
    async () => {
      const snapshot =
        await campaign.getCampaignSnapshot(
          1n,
        );

      console.log(snapshot);
    };

  return (
    <button onClick={load}>
      Load Campaign
    </button>
  );
}
~~~

The hook exposes:

~~~text
getCampaign
getActivationRule
isVerifier
claimableReward
agentTotalEarned
availableUnusedFunds
isInitialized
protocolAdmin
nextCampaignId
getCampaignSnapshot
getAgentRewardSummary
~~~

## React Writes

`useCampaignWriter` connects the Campaign write flow to the wallet configured in
`AxionveraProvider`.

The flow is:

~~~text
prepare -> wallet sign -> submit
~~~

~~~tsx
import {
  useCampaignWriter,
} from '@axionvera/react';

function FundCampaignButton() {
  const {
    fundCampaign,
    isSubmitting,
    error,
    result,
    resetError,
  } = useCampaignWriter({
    contractId: 'C...',
  });

  const fund =
    async () => {
      await fundCampaign({
        campaignId: 1n,
        amount: 100_000_000n,
      });
    };

  if (error) {
    return (
      <button onClick={resetError}>
        {error.message}
      </button>
    );
  }

  return (
    <button
      disabled={isSubmitting}
      onClick={fund}
    >
      {isSubmitting
        ? 'Funding...'
        : 'Fund Campaign'}
      {result?.hash
        ? ` ${result.hash}`
        : ''}
    </button>
  );
}
~~~

A connected wallet is required before a Campaign write action can run.

The hook exposes all 12 Campaign writes:

~~~text
initialize
createCampaign
fundCampaign
addActivationRule
addVerifier
removeVerifier
pauseCampaign
resumeCampaign
closeCampaign
withdrawUnusedFunds
verifyAndAllocateReward
claimReward
~~~

## Verified Testnet Integration

The Campaign integration was exercised against Stellar testnet on
25 September 2026.

Verified deployment:

~~~text
Campaign contract:
CAAXCSTGNQ6S73XRXYSKAEEWZNVS7XWA4EF67DRWDPS2XFSXXA3AC2C6

Native testnet SAC:
CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC
~~~

The live verification covered:

- initialization
- campaign creation
- campaign funding
- activation rule creation
- verifier addition
- reward allocation
- reward claim
- pause
- resume
- close
- unused-fund withdrawal
- post-write state reads
- live RPC event retrieval
- typed event decoding

The live event reader returned 11 emitted Campaign lifecycle events and decoded all
11 successfully with zero unrecognized events.

`verifier_removed` is covered by unit tests but was not emitted during that specific
live lifecycle because the verifier was not removed.

Stellar testnet state and RPC retention are not permanent. Treat the deployment IDs
above as a verified integration reference, not as a guarantee that the deployment
will remain available indefinitely.

## Testing

Campaign coverage includes:

- Core contract interface tests
- live-read encoding and mapping tests
- live-write preparation tests
- Campaign error normalization tests
- Campaign event decoder tests
- live event reader tests
- helper tests
- React read-hook tests
- React write-hook tests

At completion of the Campaign integration, the repository regression suite contained:

~~~text
32 test files
704 passing tests
~~~

## Related APIs

For lower-level transaction and wallet behaviour, see:

- `WalletConnector`
- `requestWalletSignature`
- `StellarCampaignWriter`
- `submitSignedTransaction`
- `useTransactionAction`
- `AxionveraProvider`

For generic Soroban event parsing outside the Campaign contract, see
[`PARSE_EVENTS_FEATURE.md`](./PARSE_EVENTS_FEATURE.md).
