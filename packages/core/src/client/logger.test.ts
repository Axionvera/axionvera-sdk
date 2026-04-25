import { Logger } from '../../src/utils/logger';

describe('Logger', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
    jest.spyOn(console, 'info').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should not log when level is "none"', () => {
    const logger = new Logger('none');
    logger.error('test');
    expect(console.error).not.toHaveBeenCalled();
  });

  test('should respect log level priority', () => {
    const logger = new Logger('warn');
    logger.info('this should not show');
    logger.warn('this should show');
    logger.error('this should also show');

    expect(console.info).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('[Axionvera][WARN] this should show'));
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('[Axionvera][ERROR] this should also show'));
  });

  describe('Redaction', () => {
    const logger = new Logger('debug');

    test('should redact Bearer tokens in strings', () => {
      logger.debug('Header: Bearer s3cr3t-t0k3n-123');
      expect(console.debug).toHaveBeenCalledWith(
        expect.stringContaining('[Axionvera][DEBUG] Header: Bearer [REDACTED]')
      );
    });

    test('should redact sensitive keys in objects', () => {
      const sensitiveObj = {
        apiKey: '12345',
        publicData: 'hello',
        nested: {
          password: 'password123'
        }
      };
      logger.debug('Data:', sensitiveObj);
      
      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1]).toEqual({
        apiKey: '[REDACTED]',
        publicData: 'hello',
        nested: {
          password: '[REDACTED]'
        }
      });
    });

    test('should redact sensitive keys in arrays', () => {
      const list = [{ token: 'abc' }, { id: 1 }];
      logger.debug('List:', list);
      
      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1]).toEqual([{ token: '[REDACTED]' }, { id: 1 }]);
    });

    test('should redact sensitive information in Error objects', () => {
      const error = new Error('Failed with key: my-secret-key');
      (error as any).apiKey = 'secret';
      
      logger.error('An error occurred', error);
      
      const calledArgs = (console.error as jest.Mock).mock.calls[0];
      expect(calledArgs[1].message).not.toContain('my-secret-key');
      expect(calledArgs[1].apiKey).toBe('[REDACTED]');
    });

    test('should redact keys regardless of casing', () => {
      const obj = { AUTHORIZATION: 'Bearer x', X_API_KEY: 'y' };
      logger.debug('Headers', obj);
      
      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1].AUTHORIZATION).toBe('[REDACTED]');
      expect(calledArgs[1].X_API_KEY).toBe('[REDACTED]');
    });

    test('should redact Stellar secret key on "secret" key', () => {
      const obj = { secret: 'SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK' };
      logger.debug('Wallet', obj);

      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1].secret).toBe('[REDACTED]');
      // Ensure the raw secret never appears anywhere in the output
      expect(JSON.stringify(consoleSpy.mock.calls[0])).not.toContain('SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK');
    });

    test('should redact Stellar secret key on "secretKey" key', () => {
      const obj = { secretKey: 'SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK' };
      logger.debug('Wallet', obj);

      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1].secretKey).toBe('[REDACTED]');
      expect(JSON.stringify(consoleSpy.mock.calls[0])).not.toContain('SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK');
    });

    test('should redact network passphrase on "passphrase" key', () => {
      const obj = { passphrase: 'Test SDF Network ; September 2015', endpoint: 'https://horizon-testnet.stellar.org' };
      logger.debug('Network config', obj);

      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1].passphrase).toBe('[REDACTED]');
      expect(calledArgs[1].endpoint).toBe('https://horizon-testnet.stellar.org');
    });

    test('should redact nested secret and passphrase fields', () => {
      const obj = {
        network: {
          passphrase: 'Public Global Stellar Network ; September 2015',
          rpcUrl: 'https://soroban-rpc.stellar.org',
        },
        wallet: {
          secretKey: 'SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK',
          publicKey: 'GABC123',
        },
      };
      logger.debug('Config', obj);

      const calledArgs = consoleSpy.mock.calls[0];
      expect(calledArgs[1].network.passphrase).toBe('[REDACTED]');
      expect(calledArgs[1].network.rpcUrl).toBe('https://soroban-rpc.stellar.org');
      expect(calledArgs[1].wallet.secretKey).toBe('[REDACTED]');
      expect(calledArgs[1].wallet.publicKey).toBe('GABC123');
    });

    test('secret key must never reach stdout', () => {
      // Restore real console.debug to verify nothing leaks through
      jest.restoreAllMocks();
      const stdoutSpy = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
      const stderrSpy = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);

      const sensitiveLogger = new Logger('debug');
      sensitiveLogger.debug('Signing tx', {
        secret: 'SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK',
        passphrase: 'Test SDF Network ; September 2015',
      });

      const allOutput = [
        ...stdoutSpy.mock.calls.map((c) => String(c[0])),
        ...stderrSpy.mock.calls.map((c) => String(c[0])),
      ].join('');

      expect(allOutput).not.toContain('SCZANGBA5RLGSRSGIDJIS7LJFTD3GVLKIGJTCRWUWDIVRAY3ZKOLA6CK');
      expect(allOutput).not.toContain('Test SDF Network ; September 2015');

      stdoutSpy.mockRestore();
      stderrSpy.mockRestore();
    });

    test('should truncate large XDR-like base64 strings', () => {
      // Simulate a large XDR blob (pure base64, >200 chars)
      const xdrBlob = 'A'.repeat(300);
      logger.debug(xdrBlob);

      const logged: string = consoleSpy.mock.calls[0][0];
      expect(logged).toContain('[TRUNCATED]');
      expect(logged.length).toBeLessThan(xdrBlob.length + 50); // well shorter than original
    });
  });
});