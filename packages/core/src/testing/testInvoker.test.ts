import { describe, expect, it } from 'vitest';

import type { ContractInvoker } from '../contracts/vault';
import { ContractError } from '../errors';
import {
  TestContractInvoker,
  createTestContractInvoker
} from './testInvoker';
const CONTRACT_ID = 'vault-contract-id';

describe('TestContractInvoker', () => {
  describe('interface', () => {
    it('satisfies the ContractInvoker interface', () => {
      const invoker: ContractInvoker = new TestContractInvoker();
      expect(invoker.invoke).toBeTypeOf('function');
      expect(invoker.read).toBeTypeOf('function');
    });

    it('createTestContractInvoker returns a TestContractInvoker instance', () => {
      const invoker = createTestContractInvoker();
      expect(invoker).toBeInstanceOf(TestContractInvoker);
    });
  });

  describe('call history', () => {
    it('records contractId, method, and args for each read call', async () => {
      const invoker = new TestContractInvoker().setReadResponse('get_balance', {
        amount: 10n
      });

      await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_balance',
        args: ['GABC']
      });

      expect(invoker.calls).toEqual([
        {
          kind: 'read',
          contractId: CONTRACT_ID,
          method: 'get_balance',
          args: ['GABC']
        }
      ]);
    });

    it('records contractId, method, and args for each invoke call', async () => {
      const invoker = new TestContractInvoker().setInvokeResponse('deposit', {
        status: 'success'
      });

      await invoker.invoke({
        contractId: CONTRACT_ID,
        method: 'deposit',
        args: ['GABC', '100']
      });

      expect(invoker.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: ['GABC', '100']
        }
      ]);
    });

    it('appends calls in order across read and invoke', async () => {
      const invoker = new TestContractInvoker()
        .setReadResponse('get_info', { contractId: CONTRACT_ID })
        .setInvokeResponse('withdraw', { status: 'pending' });

      await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });
      await invoker.invoke({
        contractId: CONTRACT_ID,
        method: 'withdraw',
        args: ['GXYZ', '50']
      });

      expect(invoker.calls).toHaveLength(2);
      expect(invoker.calls[0]?.kind).toBe('read');
      expect(invoker.calls[1]?.kind).toBe('invoke');
    });

    it('clearCalls empties history without clearing responses', async () => {
      const invoker = new TestContractInvoker().setReadResponse('get_info', {
        ok: true
      });

      await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });
      invoker.clearCalls();

      expect(invoker.calls).toEqual([]);

      const result = await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });
      expect(result).toEqual({ ok: true });
      expect(invoker.calls).toHaveLength(1);
    });
  });

  describe('read responses', () => {
    it('returns the configured read response for a method', async () => {
      const response = { address: 'GABC', amount: 42n };
      const invoker = new TestContractInvoker().setReadResponse(
        'get_balance',
        response
      );

      const result = await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_balance',
        args: ['GABC']
      });

      expect(result).toBe(response);
    });

    it('uses defaultReadResponse when no method response is set', async () => {
      const invoker = new TestContractInvoker({
        defaultReadResponse: { fallback: true }
      });

      const result = await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });

      expect(result).toEqual({ fallback: true });
    });

    it('prefers method-specific read response over the default', async () => {
      const invoker = new TestContractInvoker({
        defaultReadResponse: { fallback: true }
      }).setReadResponse('get_info', { specific: true });

      const result = await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });

      expect(result).toEqual({ specific: true });
    });
  });

  describe('invoke responses', () => {
    it('returns the configured invoke response for a method', async () => {
      const response = { status: 'success', hash: 'abc' };
      const invoker = new TestContractInvoker().setInvokeResponse(
        'deposit',
        response
      );

      const result = await invoker.invoke({
        contractId: CONTRACT_ID,
        method: 'deposit',
        args: ['GABC', '100']
      });

      expect(result).toBe(response);
    });

    it('uses defaultInvokeResponse when no method response is set', async () => {
      const invoker = new TestContractInvoker({
        defaultInvokeResponse: { status: 'success' }
      });

      const result = await invoker.invoke({
        contractId: CONTRACT_ID,
        method: 'claim_rewards',
        args: ['GABC']
      });

      expect(result).toEqual({ status: 'success' });
    });
  });

  describe('forced errors', () => {
    it('rejects read when failOnRead is configured', async () => {
      const error = new ContractError('read boom');
      const invoker = new TestContractInvoker()
        .setReadResponse('get_info', {})
        .failOnRead(error);

      await expect(
        invoker.read({
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: []
        })
      ).rejects.toBe(error);

      expect(invoker.calls).toHaveLength(1);
      expect(invoker.calls[0]?.kind).toBe('read');
    });

    it('rejects invoke when failOnInvoke is configured', async () => {
      const error = new Error('invoke boom');
      const invoker = new TestContractInvoker()
        .setInvokeResponse('deposit', { status: 'success' })
        .failOnInvoke(error);

      await expect(
        invoker.invoke({
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: ['GABC', '1']
        })
      ).rejects.toBe(error);

      expect(invoker.calls).toHaveLength(1);
      expect(invoker.calls[0]?.kind).toBe('invoke');
    });

    it('uses a default ContractError when failOnRead is called without an argument', async () => {
      const invoker = new TestContractInvoker().failOnRead();

      await expect(
        invoker.read({
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: []
        })
      ).rejects.toBeInstanceOf(ContractError);
    });

    it('clearForcedErrors restores successful responses', async () => {
      const invoker = new TestContractInvoker()
        .setInvokeResponse('deposit', { status: 'success' })
        .failOnInvoke(new Error('temporary'));

      await expect(
        invoker.invoke({
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: []
        })
      ).rejects.toThrow('temporary');

      invoker.clearForcedErrors();

      await expect(
        invoker.invoke({
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: []
        })
      ).resolves.toEqual({ status: 'success' });
    });

    it('does not apply read failures to invoke calls', async () => {
      const invoker = new TestContractInvoker()
        .setInvokeResponse('deposit', { status: 'success' })
        .failOnRead(new Error('read only'));

      await expect(
        invoker.invoke({
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: []
        })
      ).resolves.toEqual({ status: 'success' });
    });
  });

  describe('edge cases', () => {
    it('throws ContractError when no read response is configured', async () => {
      const invoker = new TestContractInvoker();

      await expect(
        invoker.read({
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: []
        })
      ).rejects.toThrow(ContractError);

      await expect(
        invoker.read({
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: []
        })
      ).rejects.toThrow('No read response configured for method "get_info"');

      expect(invoker.calls).toHaveLength(2);
    });

    it('throws ContractError when no invoke response is configured', async () => {
      const invoker = new TestContractInvoker();

      await expect(
        invoker.invoke({
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: []
        })
      ).rejects.toThrow('No invoke response configured for method "deposit"');
    });

    it('reset clears calls, responses, and forced errors', async () => {
      const invoker = new TestContractInvoker({
        defaultReadResponse: { kept: false }
      })
        .setReadResponse('get_info', { ok: true })
        .failOnInvoke(new Error('boom'));

      await invoker.read({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });

      invoker.reset();

      expect(invoker.calls).toEqual([]);

      await expect(
        invoker.read({
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: []
        })
      ).rejects.toThrow('No read response configured');

      await expect(
        invoker.invoke({
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: []
        })
      ).rejects.toThrow('No invoke response configured');
    });

    it('setters are chainable', () => {
      const invoker = new TestContractInvoker()
        .setReadResponse('get_info', {})
        .setInvokeResponse('deposit', { status: 'success' })
        .failOnRead()
        .clearForcedErrors()
        .failOnInvoke();

      expect(invoker).toBeInstanceOf(TestContractInvoker);
    });
  });
});
