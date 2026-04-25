#!/usr/bin/env node

const fs = require('fs/promises');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

const TEMPLATE_DIR = path.join(__dirname, '..', 'template');

function print(message) {
  process.stdout.write(`${message}\n`);
}

function printError(message) {
  process.stderr.write(`${message}\n`);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    appName: null,
    install: false,
    force: false,
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === '--install' || arg === '-i') {
      options.install = true;
    } else if (arg === '--force' || arg === '-f') {
      options.force = true;
    } else if (!arg.startsWith('-') && !options.appName) {
      options.appName = arg;
    }
  }

  return options;
}

function normalizePackageName(name) {
  return name
    .trim()
    .replace(/^\./, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'axionvera-dapp';
}

async function prompt(question, defaultValue) {
  if (!process.stdin.isTTY) {
    return defaultValue;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    const suffix = defaultValue ? ` (${defaultValue})` : '';
    rl.question(`${question}${suffix}: `, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function promptConfirm(question, defaultValue = true) {
  if (!process.stdin.isTTY) {
    return defaultValue;
  }

  const answer = await prompt(`${question} ${defaultValue ? '[Y/n]' : '[y/N]'}`, defaultValue ? 'y' : 'n');
  return /^y(es)?$/i.test(answer);
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function isDirectoryEmpty(targetPath) {
  const entries = await fs.readdir(targetPath);
  return entries.length === 0;
}

async function ensureTargetDirectory(targetDir, force) {
  if (!(await pathExists(targetDir))) {
    await fs.mkdir(targetDir, { recursive: true });
    return;
  }

  if (force) {
    return;
  }

  if (!(await isDirectoryEmpty(targetDir))) {
    throw new Error(`Target directory "${targetDir}" already exists and is not empty.`);
  }
}

async function copyTemplateFile(source, destination, replacements) {
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
    await fs.mkdir(destination, { recursive: true });
    const entries = await fs.readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      await copyTemplateFile(path.join(source, entry.name), path.join(destination, entry.name), replacements);
    }
    return;
  }

  const contents = await fs.readFile(source, 'utf8');
  const rendered = contents
    .replace(/__APP_NAME__/g, replacements.appName)
    .replace(/__PROJECT_SLUG__/g, replacements.projectSlug);

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, rendered, 'utf8');
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function main() {
  const options = parseArgs(process.argv);
  const defaultName = options.appName || await prompt('Project name', 'my-axionvera-dapp');
  const targetDir = path.resolve(process.cwd(), defaultName);
  const projectSlug = normalizePackageName(path.basename(targetDir));

  await ensureTargetDirectory(targetDir, options.force);

  const replacements = {
    appName: path.basename(targetDir),
    projectSlug,
  };

  await copyTemplateFile(TEMPLATE_DIR, targetDir, replacements);

  const packageJsonPath = path.join(targetDir, 'package.json');
  const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
  packageJson.name = projectSlug;
  await fs.writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');

  print(`Created ${path.basename(targetDir)} in ${targetDir}`);

  let shouldInstall = options.install;
  if (!shouldInstall) {
    shouldInstall = await promptConfirm('Install dependencies now?', true);
  }

  if (shouldInstall) {
    try {
      await runCommand('npm', ['install'], targetDir);
    } catch (error) {
      printError(`Dependency installation failed: ${error.message}`);
      print('You can install dependencies manually inside the generated project.');
    }
  }

  print('');
  print('Next steps:');
  print(`  cd ${path.basename(targetDir)}`);
  print('  npm run dev');
  print('');
  print('Update `.env.local` from `.env.example` before connecting the Vault page to your testnet wallet.');
}

main().catch((error) => {
  printError(error && error.message ? error.message : String(error));
  process.exit(1);
});
