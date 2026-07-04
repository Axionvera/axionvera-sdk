#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
const DEFAULT_IGNORES = new Set(['node_modules', 'dist', 'coverage', '.git']);

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function isSourceFile(filePath) {
  return SOURCE_EXTENSIONS.includes(path.extname(filePath));
}

function walkFiles(rootDir) {
  const files = [];

  function visit(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (DEFAULT_IGNORES.has(entry.name)) continue;
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
      } else if (entry.isFile() && isSourceFile(fullPath)) {
        files.push(fullPath);
      }
    }
  }

  visit(rootDir);
  return files.sort();
}

function collectImportSpecifiers(source) {
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^'";\n]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  const specifiers = new Set();

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers].sort();
}

function resolveInternalImport(fromFile, specifier, rootDir) {
  if (!specifier.startsWith('.')) return null;

  const basePath = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [];
  const ext = path.extname(basePath);

  if (ext) {
    candidates.push(basePath);
  } else {
    for (const sourceExt of SOURCE_EXTENSIONS) {
      candidates.push(`${basePath}${sourceExt}`);
    }
    for (const sourceExt of SOURCE_EXTENSIONS) {
      candidates.push(path.join(basePath, `index${sourceExt}`));
    }
  }

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate) || !fs.statSync(candidate).isFile()) continue;
    const relative = path.relative(rootDir, candidate);
    if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
    return path.resolve(candidate);
  }

  return null;
}

function canonicalCycle(cycle) {
  const withoutDuplicateTail = cycle.slice(0, -1);
  let best = withoutDuplicateTail;

  for (let i = 1; i < withoutDuplicateTail.length; i += 1) {
    const rotated = withoutDuplicateTail.slice(i).concat(withoutDuplicateTail.slice(0, i));
    if (rotated.join('\0') < best.join('\0')) {
      best = rotated;
    }
  }

  return best.concat(best[0]);
}

function findCycles(graph) {
  const cycles = [];
  const seen = new Set();
  const state = new Map();
  const stack = [];

  function visit(node) {
    state.set(node, 'visiting');
    stack.push(node);

    for (const next of graph.get(node) || []) {
      if (!state.has(next)) {
        visit(next);
      } else if (state.get(next) === 'visiting') {
        const start = stack.indexOf(next);
        const cycle = canonicalCycle(stack.slice(start).concat(next));
        const key = cycle.join(' -> ');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      }
    }

    stack.pop();
    state.set(node, 'visited');
  }

  for (const node of [...graph.keys()].sort()) {
    if (!state.has(node)) visit(node);
  }

  return cycles.sort((a, b) => a.join('\0').localeCompare(b.join('\0')));
}

function analyzeDependencies(options = {}) {
  const rootDir = path.resolve(options.root || path.join(process.cwd(), 'src'));
  const files = walkFiles(rootDir);
  const graph = new Map();
  const externalImports = new Map();

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    const node = toPosix(path.relative(rootDir, file));
    const internalEdges = new Set();
    const external = new Set();

    for (const specifier of collectImportSpecifiers(source)) {
      const resolved = resolveInternalImport(file, specifier, rootDir);
      if (resolved) {
        internalEdges.add(toPosix(path.relative(rootDir, resolved)));
      } else if (!specifier.startsWith('.')) {
        external.add(specifier);
      }
    }

    graph.set(node, [...internalEdges].sort());
    if (external.size > 0) externalImports.set(node, [...external].sort());
  }

  const fanIn = new Map([...graph.keys()].map((node) => [node, 0]));
  for (const edges of graph.values()) {
    for (const target of edges) {
      fanIn.set(target, (fanIn.get(target) || 0) + 1);
    }
  }

  const nodes = [...graph.keys()].sort();
  const edges = nodes.flatMap((from) => graph.get(from).map((to) => ({ from, to })));
  const coupling = nodes
    .map((node) => ({
      node,
      fanIn: fanIn.get(node) || 0,
      fanOut: graph.get(node).length,
      total: (fanIn.get(node) || 0) + graph.get(node).length,
    }))
    .sort((a, b) => b.total - a.total || b.fanIn - a.fanIn || a.node.localeCompare(b.node));

  const cycles = findCycles(graph);

  return {
    root: rootDir,
    generatedAt: new Date().toISOString(),
    totals: {
      files: nodes.length,
      internalEdges: edges.length,
      externalImportSites: externalImports.size,
      cycles: cycles.length,
    },
    nodes,
    edges,
    cycles,
    coupling,
    externalImports: Object.fromEntries(externalImports),
  };
}

function formatMarkdown(report, options = {}) {
  const maxEdges = Number.isFinite(options.maxEdges) ? options.maxEdges : 80;
  const lines = [
    '# SDK Dependency Graph Report',
    '',
    `Root: \`${toPosix(report.root)}\``,
    `Generated: ${report.generatedAt}`,
    '',
    '## Summary',
    '',
    `- Files analyzed: ${report.totals.files}`,
    `- Internal dependency edges: ${report.totals.internalEdges}`,
    `- Files with external imports: ${report.totals.externalImportSites}`,
    `- Circular dependency cycles: ${report.cycles.length}`,
    '',
    '## Circular Dependencies',
    '',
  ];

  if (report.cycles.length === 0) {
    lines.push('No circular dependencies detected.', '');
  } else {
    for (const cycle of report.cycles) {
      lines.push(`- ${cycle.map((node) => `\`${node}\``).join(' -> ')}`);
    }
    lines.push('');
  }

  lines.push('## Coupling Hotspots', '');
  lines.push('| Module | Fan-in | Fan-out | Total |');
  lines.push('| --- | ---: | ---: | ---: |');
  for (const item of report.coupling.slice(0, 15)) {
    lines.push(`| \`${item.node}\` | ${item.fanIn} | ${item.fanOut} | ${item.total} |`);
  }

  lines.push('', '## Dependency Edges', '');
  for (const edge of report.edges.slice(0, maxEdges)) {
    lines.push(`- \`${edge.from}\` -> \`${edge.to}\``);
  }
  if (report.edges.length > maxEdges) {
    lines.push(`- ... ${report.edges.length - maxEdges} more edges omitted; rerun with --format json for the full graph.`);
  }

  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = {
    root: path.join(process.cwd(), 'src'),
    format: 'markdown',
    failOnCycles: false,
    maxEdges: 80,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--root') {
      options.root = argv[++i];
    } else if (arg === '--format') {
      options.format = argv[++i];
    } else if (arg === '--fail-on-cycles') {
      options.failOnCycles = true;
    } else if (arg === '--max-edges') {
      options.maxEdges = Number(argv[++i]);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function printHelp() {
  console.log(`Usage: node scripts/analyze-dependencies.js [options]

Options:
  --root <path>          Source root to analyze (default: ./src)
  --format <type>        Output format: markdown or json (default: markdown)
  --fail-on-cycles       Exit with code 1 when circular dependencies are found
  --max-edges <count>    Number of edges to include in markdown output (default: 80)
`);
}

if (require.main === module) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
      process.exit(0);
    }

    const report = analyzeDependencies({ root: options.root });

    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else if (options.format === 'markdown') {
      process.stdout.write(formatMarkdown(report, { maxEdges: options.maxEdges }));
    } else {
      throw new Error(`Unsupported format: ${options.format}`);
    }

    if (options.failOnCycles && report.cycles.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }
}

module.exports = {
  analyzeDependencies,
  collectImportSpecifiers,
  findCycles,
  formatMarkdown,
  resolveInternalImport,
};
