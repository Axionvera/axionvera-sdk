import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    vault: 'src/contracts/index.ts',
    client: 'src/client/index.ts',
    utils: 'src/utils/index.ts',
    wallet: 'src/wallet/index.ts',
    codegen: 'src/codegen/index.ts',
  },
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: true,
  external: ['@stellar/stellar-sdk', 'axios'],
});
