import fs from 'fs';
import os from 'os';
import path from 'path';

const {
  analyzeDependencies,
  collectImportSpecifiers,
  formatMarkdown,
} = require('../../scripts/analyze-dependencies.js');

function makeFixture(files: Record<string, string>) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'axionvera-deps-'));
  for (const [relativePath, contents] of Object.entries(files)) {
    const fullPath = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, contents, 'utf8');
  }
  return root;
}

describe('dependency graph analyzer', () => {
  it('collects static, side-effect, dynamic, and require imports', () => {
    const source = `
      import type { Foo } from './types';
      import { Bar } from './bar';
      import './polyfill';
      const lazy = import('./lazy');
      const legacy = require('./legacy');
    `;

    expect(collectImportSpecifiers(source)).toEqual([
      './bar',
      './lazy',
      './legacy',
      './polyfill',
      './types',
    ]);
  });

  it('builds internal edges, ignores externals, and detects cycles', () => {
    const root = makeFixture({
      'index.ts': "import { a } from './a'; import '@stellar/stellar-sdk';\nexport { a };",
      'a.ts': "import { b } from './nested/b'; export const a = b;",
      'nested/b.ts': "import { c } from './c'; export const b = c;",
      'nested/c.ts': "import { a } from '../a'; export const c = a;",
      'standalone.ts': "import fs from 'fs'; export const ok = true;",
    });

    try {
      const report = analyzeDependencies({ root });

      expect(report.edges).toEqual(
        expect.arrayContaining([
          { from: 'index.ts', to: 'a.ts' },
          { from: 'a.ts', to: 'nested/b.ts' },
          { from: 'nested/b.ts', to: 'nested/c.ts' },
          { from: 'nested/c.ts', to: 'a.ts' },
        ])
      );
      expect(report.cycles).toEqual([
        ['a.ts', 'nested/b.ts', 'nested/c.ts', 'a.ts'],
      ]);
      expect(report.externalImports['index.ts']).toEqual(['@stellar/stellar-sdk']);
      expect(report.externalImports['standalone.ts']).toEqual(['fs']);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it('formats markdown with summary, cycles, and hotspots', () => {
    const root = makeFixture({
      'index.ts': "import { a } from './a';",
      'a.ts': 'export const a = 1;',
    });

    try {
      const report = analyzeDependencies({ root });
      const markdown = formatMarkdown(report);

      expect(markdown).toContain('# SDK Dependency Graph Report');
      expect(markdown).toContain('Files analyzed: 2');
      expect(markdown).toContain('No circular dependencies detected.');
      expect(markdown).toContain('`index.ts` -> `a.ts`');
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
