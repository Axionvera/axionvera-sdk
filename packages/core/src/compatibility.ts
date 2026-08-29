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

function argumentsMatch(
  expected: readonly CompatibilityArgumentExpectation[],
  actual: readonly CompatibilityArgumentExpectation[]
): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((argument, index) => {
    const actualArgument = actual[index];
    return actualArgument?.name === argument.name && actualArgument.type === argument.type;
  });
}

function stringArraysMatch(expected: readonly string[], actual: readonly string[]): boolean {
  if (expected.length !== actual.length) {
    return false;
  }

  return expected.every((value, index) => actual[index] === value);
}

function dataShapeMatches(
  expected: Record<string, string>,
  actual: Record<string, string>
): boolean {
  const expectedEntries = Object.entries(expected);
  const actualEntries = Object.entries(actual);

  if (expectedEntries.length !== actualEntries.length) {
    return false;
  }

  return expectedEntries.every(([key, value]) => actual[key] === value);
}

export function compareVaultInterfaceMethods(
  sdkFixture: VaultInterfaceCompatibilityFixture,
  networkFixture: NetworkVaultInterfaceFixture
): MethodCompatibilityResult[] {
  return sdkFixture.methods.map((sdkMethod) => {
    const networkMethod = networkFixture.methods.find(
      (method) => method.name === sdkMethod.networkName
    );
    const actualArguments = networkMethod?.arguments ?? [];

    return {
      sdkName: sdkMethod.sdkName,
      networkName: sdkMethod.networkName,
      methodExists: Boolean(networkMethod),
      methodKindMatches: networkMethod?.kind === sdkMethod.kind,
      argumentOrderMatches: argumentsMatch(sdkMethod.arguments, actualArguments),
      expectedArguments: sdkMethod.arguments,
      actualArguments,
    };
  });
}

export function compareVaultInterfaceEvents(
  sdkFixture: VaultInterfaceCompatibilityFixture,
  networkFixture: NetworkVaultInterfaceFixture
): EventCompatibilityResult[] {
  return sdkFixture.events.map((sdkEvent) => {
    const networkEvent = networkFixture.events.find((event) => event.name === sdkEvent.name);
    const actualTopics = networkEvent?.topics ?? [];
    const actualData = networkEvent?.data ?? {};

    return {
      name: sdkEvent.name,
      eventExists: Boolean(networkEvent),
      topicsMatch: stringArraysMatch(sdkEvent.topics, actualTopics),
      dataShapeMatches: dataShapeMatches(sdkEvent.data, actualData),
      expectedTopics: sdkEvent.topics,
      actualTopics,
      expectedData: sdkEvent.data,
      actualData,
    };
  });
}

export function compareVaultInterfaceCompatibility(
  sdkFixture: VaultInterfaceCompatibilityFixture,
  networkFixture: NetworkVaultInterfaceFixture
): VaultInterfaceCompatibilityResult {
  const methods = compareVaultInterfaceMethods(sdkFixture, networkFixture);
  const events = compareVaultInterfaceEvents(sdkFixture, networkFixture);
  const compatible =
    methods.every(
      (method) => method.methodExists && method.methodKindMatches && method.argumentOrderMatches
    ) &&
    events.every((event) => event.eventExists && event.topicsMatch && event.dataShapeMatches);

  return {
    compatible,
    methods,
    events,
  };
}

export function formatVaultCompatibilityReport(
  result: VaultInterfaceCompatibilityResult
): string {
  const lines = [
    `Vault compatibility: ${result.compatible ? 'compatible' : 'incompatible'}`,
    'Methods:',
    ...result.methods.map(
      (method) =>
        `- ${method.sdkName} -> ${method.networkName}: ${
          method.methodExists && method.methodKindMatches && method.argumentOrderMatches
            ? 'ok'
            : 'mismatch'
        }`
    ),
    'Events:',
    ...result.events.map(
      (event) =>
        `- ${event.name}: ${
          event.eventExists && event.topicsMatch && event.dataShapeMatches ? 'ok' : 'mismatch'
        }`
    ),
  ];

  return lines.join('\n');
}
