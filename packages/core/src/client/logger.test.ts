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
  });
});