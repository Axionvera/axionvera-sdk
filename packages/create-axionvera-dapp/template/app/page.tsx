'use client';

import { FormEvent, useState } from 'react';
import { BrowserWalletConnector, StellarClient, VaultContract } from 'axionvera-sdk';

const network = (process.env.NEXT_PUBLIC_AXIONVERA_NETWORK ?? 'testnet') as 'testnet' | 'mainnet';
const rpcUrl = process.env.NEXT_PUBLIC_AXIONVERA_RPC_URL ?? 'https://soroban-testnet.stellar.org';
const vaultId = process.env.NEXT_PUBLIC_AXIONVERA_VAULT_CONTRACT_ID ?? '';

const wallet = new BrowserWalletConnector();
const client = new StellarClient({
  network,
  rpcUrl,
  wallet,
});
const vault = new VaultContract({
  client,
  contractId: vaultId,
  wallet,
});

function stringify(value: unknown): string {
  return JSON.stringify(
    value,
    (_, current) => (typeof current === 'bigint' ? current.toString() : current),
    2
  );
}

function toBigIntAmount(input: string): bigint {
  if (!/^\d+$/.test(input.trim())) {
    throw new Error('Amount must be a whole number.');
  }

  const value = BigInt(input.trim());
  if (value <= 0n) {
    throw new Error('Amount must be greater than zero.');
  }

  return value;
}

export default function Page() {
  const [publicKey, setPublicKey] = useState('');
  const [balance, setBalance] = useState('0');
  const [depositAmount, setDepositAmount] = useState('10');
  const [withdrawAmount, setWithdrawAmount] = useState('5');
  const [status, setStatus] = useState('Connect Freighter to start.');
  const [busy, setBusy] = useState(false);
  const [txResult, setTxResult] = useState('');

  const configured = Boolean(vaultId && rpcUrl);

  async function connectWallet() {
    setBusy(true);
    try {
      const key = await wallet.getPublicKey();
      if (!key) {
        throw new Error('Wallet connector is unavailable.');
      }

      setPublicKey(key);
      setStatus(`Connected to ${key.slice(0, 6)}...${key.slice(-6)}`);
      const currentBalance = await vault.getBalance(key);
      setBalance(currentBalance.toString());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to connect wallet.');
    } finally {
      setBusy(false);
    }
  }

  async function refreshBalance() {
    if (!publicKey) {
      setStatus('Connect a wallet first.');
      return;
    }

    setBusy(true);
    try {
      const currentBalance = await vault.getBalance(publicKey);
      setBalance(currentBalance.toString());
      setStatus('Balance refreshed.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to refresh balance.');
    } finally {
      setBusy(false);
    }
  }

  async function runTransaction(kind: 'deposit' | 'withdraw', amountText: string) {
    if (!publicKey) {
      throw new Error('Connect a wallet first.');
    }

    const amount = toBigIntAmount(amountText);
    const result =
      kind === 'deposit'
        ? await vault.deposit({ amount, from: publicKey })
        : await vault.withdraw({ amount, to: publicKey });

    setTxResult(stringify(result));
    setStatus(`${kind[0].toUpperCase()}${kind.slice(1)} submitted.`);
    const currentBalance = await vault.getBalance(publicKey);
    setBalance(currentBalance.toString());
  }

  async function handleDeposit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await runTransaction('deposit', depositAmount);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Deposit failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleWithdraw(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      await runTransaction('withdraw', withdrawAmount);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Withdraw failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-glow backdrop-blur">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-4">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-emerald-300">
                Axionvera Vault Starter
              </p>
              <h1 className="text-4xl font-semibold leading-tight text-white">
                Ship a Vault dApp that is already pointed at testnet.
              </h1>
              <p className="max-w-2xl text-sm leading-6 text-slate-300">
                Connect Freighter, deposit tokens, withdraw them back, and inspect the latest
                balance without wiring the SDK from scratch.
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Network: {network}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  RPC: {rpcUrl}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  Vault: {vaultId ? `${vaultId.slice(0, 10)}...` : 'missing'}
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/80 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Connection</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span>Wallet</span>
                  <span className={publicKey ? 'text-emerald-300' : 'text-amber-300'}>
                    {publicKey ? 'Connected' : 'Not connected'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span>Balance</span>
                  <span className="font-mono text-white">{balance}</span>
                </div>
              </div>
              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={busy || !configured}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Connect Wallet
                </button>
                <button
                  type="button"
                  onClick={refreshBalance}
                  disabled={busy || !publicKey}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        </section>

        {!configured ? (
          <section className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100">
            Fill in `.env.local` from `.env.example` before trying to submit transactions.
          </section>
        ) : null}

        <section className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={handleDeposit}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-glow"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-emerald-300">Deposit</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Add vault tokens</h2>
            <label className="mt-6 block text-sm text-slate-300">
              Amount
              <input
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                inputMode="numeric"
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-3 font-mono text-white outline-none transition focus:border-emerald-400"
                placeholder="10"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !publicKey}
              className="mt-5 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit Deposit
            </button>
          </form>

          <form
            onSubmit={handleWithdraw}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-glow"
          >
            <p className="text-xs uppercase tracking-[0.24em] text-amber-300">Withdraw</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">Pull funds back out</h2>
            <label className="mt-6 block text-sm text-slate-300">
              Amount
              <input
                value={withdrawAmount}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                inputMode="numeric"
                className="mt-2 w-full rounded-lg border border-white/10 bg-slate-950/80 px-4 py-3 font-mono text-white outline-none transition focus:border-amber-400"
                placeholder="5"
              />
            </label>
            <button
              type="submit"
              disabled={busy || !publicKey}
              className="mt-5 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Submit Withdraw
            </button>
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-glow">
            <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Status</p>
            <p className="mt-3 text-sm leading-6 text-slate-200">{status}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Wallet</p>
            <p className="mt-2 break-all font-mono text-xs text-slate-300">
              {publicKey || 'No wallet connected'}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 shadow-glow">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Transaction</p>
                <h3 className="mt-2 text-lg font-semibold text-white">Latest SDK response</h3>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                JSON
              </span>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80 p-4 text-xs leading-6 text-slate-300">
              {txResult || 'No transaction submitted yet.'}
            </pre>
          </div>
        </section>
      </div>
    </main>
  );
}
