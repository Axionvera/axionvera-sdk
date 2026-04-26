import { createHmac } from 'node:crypto';

import { verifyWebhookSignature } from '../../packages/core/src/utils/webhooks';
import { InvalidSignatureError } from '../../packages/core/src/errors/axionveraError';

function hmacHex(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

describe('verifyWebhookSignature', () => {
  const secret = 'super-secret-webhook-key';
  const payload = JSON.stringify({ event: 'vault.deposit', amount: '1000' });

  test('returns true when the signature matches', async () => {
    const signature = hmacHex(payload, secret);
    await expect(verifyWebhookSignature(payload, signature, secret)).resolves.toBe(true);
  });

  test('throws InvalidSignatureError for a tampered signature of correct length', async () => {
    const signature = hmacHex(payload, secret);
    const tampered = signature.slice(0, -1) + (signature.slice(-1) === '0' ? '1' : '0');

    await expect(verifyWebhookSignature(payload, tampered, secret)).rejects.toBeInstanceOf(
      InvalidSignatureError
    );
  });

  test('throws InvalidSignatureError when the payload differs from what was signed', async () => {
    const signature = hmacHex(payload, secret);
    await expect(
      verifyWebhookSignature(payload + ' tampered', signature, secret)
    ).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  test('throws InvalidSignatureError when the secret is wrong', async () => {
    const signature = hmacHex(payload, secret);
    await expect(
      verifyWebhookSignature(payload, signature, 'wrong-secret')
    ).rejects.toBeInstanceOf(InvalidSignatureError);
  });

  test('returns true for an empty payload signed with the correct secret', async () => {
    const signature = hmacHex('', secret);
    await expect(verifyWebhookSignature('', signature, secret)).resolves.toBe(true);
  });

  test('accepts uppercase-hex signatures (case-insensitive)', async () => {
    const signature = hmacHex(payload, secret);
    await expect(
      verifyWebhookSignature(payload, signature.toUpperCase(), secret)
    ).resolves.toBe(true);
  });

  test('throws InvalidSignatureError when the signature length differs', async () => {
    await expect(verifyWebhookSignature(payload, 'abcd', secret)).rejects.toBeInstanceOf(
      InvalidSignatureError
    );
  });
});
