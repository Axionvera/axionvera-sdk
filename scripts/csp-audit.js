const http = require('http');
const path = require('path');
const fs = require('fs');
const { build } = require('esbuild');
const { chromium } = require('playwright');

const distPath = path.resolve(__dirname, '../dist/csp-audit');
const entryPoint = path.resolve(__dirname, '../src/index.ts');
const port = process.env.CSP_AUDIT_PORT ? Number(process.env.CSP_AUDIT_PORT) : 4321;
const host = '127.0.0.1';

async function buildBundle() {
  await fs.promises.rm(distPath, { recursive: true, force: true });
  await fs.promises.mkdir(distPath, { recursive: true });

  await build({
    entryPoints: [entryPoint],
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: ['chrome120', 'firefox120', 'safari16'],
    outfile: path.join(distPath, 'axionvera-sdk.mjs'),
    sourcemap: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });

  const auditRunner = `window.cspViolations = [];
window.__sdkLoaded = false;
window.__sdkError = null;

window.addEventListener('securitypolicyviolation', event => {
  window.cspViolations.push({
    blockedURI: event.blockedURI,
    violatedDirective: event.violatedDirective,
    originalPolicy: event.originalPolicy,
    sourceFile: event.sourceFile,
  });
});

import('./axionvera-sdk.mjs')
  .then(() => {
    window.__sdkLoaded = true;
  })
  .catch(error => {
    window.__sdkError = error?.message ?? String(error);
  });
`;

  await fs.promises.writeFile(path.join(distPath, 'audit-runner.mjs'), auditRunner, 'utf8');
}

function createServer() {
  const policy = [
    "default-src 'none'",
    "script-src 'self'",
    "connect-src 'self' https://soroban-testnet.stellar.org https://soroban-mainnet.stellar.org",
    "style-src 'self'",
    "img-src 'self'",
    "font-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  return http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/index.html') {
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Security-Policy': policy,
      });
      res.end(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Axionvera CSP Audit</title>
</head>
<body>
  <script type="module" src="/audit-runner.mjs"></script>
</body>
</html>`);
      return;
    }

    const filePath = path.join(distPath, req.url || '');
    if (!filePath.startsWith(distPath)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const contentType = req.url.endsWith('.mjs') ? 'application/javascript' : 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
      });
      res.end(data);
    });
  });
}

async function runAudit() {
  await buildBundle();

  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    const url = `http://${host}:${port}`;
    await page.goto(url, { waitUntil: 'networkidle' });

    await page.waitForFunction(() => {
      return window.__sdkLoaded === true || window.__sdkError !== null || (window.cspViolations && window.cspViolations.length > 0);
    }, { timeout: 15000 });

    const result = await page.evaluate(() => ({
      sdkLoaded: window.__sdkLoaded === true,
      sdkError: window.__sdkError || null,
      violations: window.cspViolations || [],
    }));

    if (!result.sdkLoaded) {
      throw new Error(`SDK failed to load in strict CSP environment: ${result.sdkError || 'unknown error'}`);
    }

    if (result.violations.length > 0) {
      throw new Error(`CSP violations detected: ${JSON.stringify(result.violations, null, 2)}`);
    }

    console.log('✅ CSP audit passed. No unsafe inline scripts, eval, or source violations were detected.');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

runAudit().catch(error => {
  console.error(error);
  process.exit(1);
});
