import {
  Contract,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import {
  describe,
  expect,
  it,
} from 'vitest';

import { NetworkError } from './errors';
import {
  StellarCampaignEventReader,
  type StellarCampaignEventServer,
} from './sorobanLiveRead';

const CONTRACT_ID =
  'CAAXCSTGNQ6S73XRXYSKAEEWZNVS7XWA4EF67DRWDPS2XFSXXA3AC2C6';

const ADMIN =
  'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

type EventRequest =
  Parameters<StellarCampaignEventServer['getEvents']>[0];

type EventResponse =
  Awaited<
    ReturnType<
      StellarCampaignEventServer['getEvents']
    >
  >;

function symbol(value: string) {
  return nativeToScVal(
    value,
    { type: 'symbol' },
  );
}

function rpcEvent(
  topics: readonly string[],
  data: unknown,
  overrides: Partial<EventResponse['events'][number]> = {},
): EventResponse['events'][number] {
  return {
    type: 'contract',
    ledger: 12345,
    ledgerClosedAt: '2026-09-25T10:00:00Z',
    contractId: new Contract(CONTRACT_ID),
    id: 'event-1',
    operationIndex: 0,
    transactionIndex: 1,
    txHash: 'abc123',
    inSuccessfulContractCall: true,
    topic: topics.map(symbol),
    value: nativeToScVal(data),
    ...overrides,
  } as EventResponse['events'][number];
}

function rpcResponse(
  events: EventResponse['events'],
): EventResponse {
  return {
    events,
    cursor: 'cursor-123',
    latestLedger: 20000,
    oldestLedger: 10000,
    latestLedgerCloseTime: '1790354472',
    oldestLedgerCloseTime: '1789749677',
  } as EventResponse;
}

class FakeEventServer
  implements StellarCampaignEventServer {
  readonly requests: EventRequest[] = [];

  constructor(
    private readonly response: EventResponse,
  ) {}

  async getEvents(
    request: EventRequest,
  ): Promise<EventResponse> {
    this.requests.push(request);
    return this.response;
  }
}

describe('StellarCampaignEventReader', () => {
  it('requests Campaign contract events by ledger range and decodes them', async () => {
    const server = new FakeEventServer(
      rpcResponse([
        rpcEvent(
          ['campaign', 'funded'],
          [1n, ADMIN, 100_000_000n],
        ),
      ]),
    );

    const reader =
      new StellarCampaignEventReader({
        contractId: CONTRACT_ID,
        server,
      });

    const page = await reader.getEvents({
      startLedger: 12000,
      endLedger: 13000,
      limit: 25,
    });

    expect(server.requests).toEqual([
      {
        startLedger: 12000,
        endLedger: 13000,
        limit: 25,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
          },
        ],
      },
    ]);

    expect(page.events).toHaveLength(1);

    expect(page.events[0]).toMatchObject({
      type: 'funded',
      campaignId: 1n,
      admin: ADMIN,
      amount: 100_000_000n,
      contractId: CONTRACT_ID,
      transactionHash: 'abc123',
      ledger: 12345,
    });

    expect(
      page.unrecognizedEvents,
    ).toEqual([]);
  });

  it('supports cursor pagination without mixing in ledger range fields', async () => {
    const server = new FakeEventServer(
      rpcResponse([]),
    );

    const reader =
      new StellarCampaignEventReader({
        contractId: CONTRACT_ID,
        server,
      });

    await reader.getEvents({
      cursor: 'previous-cursor',
      limit: 50,
    });

    expect(server.requests).toEqual([
      {
        cursor: 'previous-cursor',
        limit: 50,
        filters: [
          {
            type: 'contract',
            contractIds: [CONTRACT_ID],
          },
        ],
      },
    ]);
  });

  it('preserves unknown Campaign events separately instead of silently dropping them', async () => {
    const unknown = rpcEvent(
      ['campaign', 'future_event'],
      [1n],
      {
        txHash: 'future-tx',
        ledger: 15000,
      },
    );

    const server = new FakeEventServer(
      rpcResponse([unknown]),
    );

    const reader =
      new StellarCampaignEventReader({
        contractId: CONTRACT_ID,
        server,
      });

    const page = await reader.getEvents({
      startLedger: 14000,
    });

    expect(page.events).toEqual([]);

    expect(
      page.unrecognizedEvents,
    ).toHaveLength(1);

    expect(
      page.unrecognizedEvents[0],
    ).toMatchObject({
      contractId: CONTRACT_ID,
      transactionHash: 'future-tx',
      ledger: 15000,
    });
  });

  it('preserves RPC pagination and retention metadata', async () => {
    const server = new FakeEventServer(
      rpcResponse([]),
    );

    const reader =
      new StellarCampaignEventReader({
        contractId: CONTRACT_ID,
        server,
      });

    const page = await reader.getEvents({
      startLedger: 12000,
    });

    expect(page).toMatchObject({
      cursor: 'cursor-123',
      latestLedger: 20000,
      oldestLedger: 10000,
      latestLedgerCloseTime: '1790354472',
      oldestLedgerCloseTime: '1789749677',
    });
  });

  it('wraps RPC failures as NetworkError', async () => {
    const server: StellarCampaignEventServer = {
      async getEvents() {
        throw new Error('RPC unavailable');
      },
    };

    const reader =
      new StellarCampaignEventReader({
        contractId: CONTRACT_ID,
        server,
      });

    await expect(
      reader.getEvents({
        startLedger: 12000,
      }),
    ).rejects.toBeInstanceOf(
      NetworkError,
    );
  });
});
