import { generateTransactionURI, generatePayURI } from '../src/utils/sep7';

describe('SEP-0007 Utils', () => {
  describe('generateTransactionURI', () => {
    it('should generate a simple transaction URI', () => {
      const xdr = 'AAAAA...';
      const uri = generateTransactionURI(xdr);
      expect(uri).toBe(`web+stellar:tx?xdr=${encodeURIComponent(xdr)}`);
    });

    it('should include callback URL if provided', () => {
      const xdr = 'AAAAA...';
      const callback = 'https://example.com/callback';
      const uri = generateTransactionURI(xdr, callback);
      expect(uri).toContain(`callback=${encodeURIComponent(`url:${callback}`)}`);
    });
  });

  describe('generatePayURI', () => {
    it('should generate a simple XLM payment URI', () => {
      const destination = 'GB6...123';
      const amount = '100.50';
      const uri = generatePayURI(destination, amount);
      expect(uri).toBe(`web+stellar:pay?destination=${destination}&amount=${encodeURIComponent(amount)}`);
    });

    it('should generate a custom asset payment URI', () => {
      const destination = 'GB6...123';
      const amount = '100.50';
      const assetCode = 'USDC';
      const assetIssuer = 'GABC...789';
      const uri = generatePayURI(destination, amount, assetCode, assetIssuer);
      expect(uri).toContain(`asset_code=${assetCode}`);
      expect(uri).toContain(`asset_issuer=${assetIssuer}`);
    });

    it('should ignore XLM as asset_code', () => {
      const destination = 'GB6...123';
      const amount = '100.50';
      const uri = generatePayURI(destination, amount, 'XLM');
      expect(uri).not.toContain('asset_code');
    });
  });
});
