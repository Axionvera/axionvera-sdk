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
