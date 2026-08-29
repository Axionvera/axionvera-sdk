export type CompatibilityMethodKind = 'read' | 'write';

export interface CompatibilityArgumentExpectation {
  name: string;
  type: string;
}

export interface CompatibilityMethodExpectation {
  sdkName: string;
  networkName: string;
  kind: CompatibilityMethodKind;
  arguments: readonly CompatibilityArgumentExpectation[];
}

export interface CompatibilityEventExpectation {
  name: string;
  topics: readonly string[];
  data: Record<string, string>;
}

export interface VaultInterfaceCompatibilityFixture {
  schemaName: string;
  schemaVersion: string;
  contract: 'Vault';
  methods: readonly CompatibilityMethodExpectation[];
  events: readonly CompatibilityEventExpectation[];
}

export interface NetworkVaultInterfaceFixture {
  schemaName: string;
  schemaVersion: string;
  contract: 'Vault';
  source: string;
  methods: readonly {
    name: string;
    kind: CompatibilityMethodKind;
    arguments: readonly CompatibilityArgumentExpectation[];
  }[];
  events: readonly CompatibilityEventExpectation[];
}

export interface MethodCompatibilityResult {
  sdkName: string;
  networkName: string;
  methodExists: boolean;
  methodKindMatches: boolean;
  argumentOrderMatches: boolean;
  expectedArguments: readonly CompatibilityArgumentExpectation[];
  actualArguments: readonly CompatibilityArgumentExpectation[];
}

export interface EventCompatibilityResult {
  name: string;
  eventExists: boolean;
  topicsMatch: boolean;
  dataShapeMatches: boolean;
  expectedTopics: readonly string[];
  actualTopics: readonly string[];
  expectedData: Record<string, string>;
  actualData: Record<string, string>;
}

export interface VaultInterfaceCompatibilityResult {
  compatible: boolean;
  methods: readonly MethodCompatibilityResult[];
  events: readonly EventCompatibilityResult[];
}

export const SDK_VAULT_INTERFACE_FIXTURE: VaultInterfaceCompatibilityFixture = {
  schemaName: 'sdk-vault-interface',
  schemaVersion: '2026-08-29.static',
  contract: 'Vault',
  methods: [
    {
      sdkName: 'getInfo',
      networkName: 'get_info',
      kind: 'read',
      arguments: [],
    },
    {
      sdkName: 'getBalance',
      networkName: 'get_balance',
      kind: 'read',
      arguments: [{ name: 'address', type: 'Address' }],
    },
    {
      sdkName: 'getPendingRewards',
      networkName: 'get_pending_rewards',
      kind: 'read',
      arguments: [{ name: 'address', type: 'Address' }],
    },
    {
      sdkName: 'deposit',
      networkName: 'deposit',
      kind: 'write',
      arguments: [
        { name: 'from', type: 'Address' },
        { name: 'amount', type: 'i128' },
      ],
    },
    {
      sdkName: 'withdraw',
      networkName: 'withdraw',
      kind: 'write',
      arguments: [
        { name: 'to', type: 'Address' },
        { name: 'amount', type: 'i128' },
      ],
    },
    {
      sdkName: 'claimRewards',
      networkName: 'claim_rewards',
      kind: 'write',
      arguments: [{ name: 'address', type: 'Address' }],
    },
  ],
  events: [
    {
      name: 'deposit',
      topics: ['deposit', 'from'],
      data: { amount: 'i128' },
    },
    {
      name: 'withdraw',
      topics: ['withdraw', 'to'],
      data: { amount: 'i128' },
    },
    {
      name: 'claim_rewards',
      topics: ['claim_rewards', 'address'],
      data: { amount: 'i128' },
    },
    {
      name: 'initialized',
      topics: ['initialized'],
      data: { admin: 'Address' },
    },
  ],
};
