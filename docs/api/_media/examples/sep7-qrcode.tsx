import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { generatePayURI } from 'axionvera-sdk/utils';

/**
 * Example React component that displays a SEP-0007 QR code for a payment.
 * Requires `qrcode.react` package.
 * 
 * Usage:
 * <StellarPaymentQRCode 
 *   destination="GB6...123" 
 *   amount="10.0" 
 *   assetCode="USDC" 
 *   assetIssuer="GA5...789" 
 * />
 */
export const StellarPaymentQRCode: React.FC<{
  destination: string;
  amount: string;
  assetCode?: string;
  assetIssuer?: string;
}> = ({ destination, amount, assetCode, assetIssuer }) => {
  // Generate the SEP-0007 URI
  const uri = generatePayURI(destination, amount, assetCode, assetIssuer);

  return (
    <div className="flex flex-col items-center p-6 bg-white rounded-xl shadow-lg">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Scan to Pay with Mobile Wallet</h2>
      
      <div className="p-4 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <QRCodeSVG 
          value={uri} 
          size={256}
          level="H"
          includeMargin={true}
          imageSettings={{
            src: "https://stellar.org/images/stellar-logo.png",
            x: undefined,
            y: undefined,
            height: 40,
            width: 40,
            excavate: true,
          }}
        />
      </div>
      
      <p className="mt-4 text-sm text-gray-500 max-w-xs text-center">
        Open LOBSTR, xBull, or any SEP-0007 compatible wallet to complete the transaction.
      </p>
      
      <a 
        href={uri}
        className="mt-6 px-6 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors font-medium"
      >
        Open in Wallet
      </a>
    </div>
  );
};
