# React Native & Expo Compatibility Guide

The Axionvera SDK uses Node.js core modules (`crypto`, `buffer`, `stream`) which are not available by default in React Native or Expo environments. To use the SDK in a mobile application, you must polyfill these modules.

## Prerequisites

Install the following dependencies in your React Native project:

```bash
npm install react-native-get-random-values react-native-quick-crypto buffer stream-browserify process
```

- `react-native-get-random-values`: Provides `crypto.getRandomValues` for secure random number generation.
- `react-native-quick-crypto`: A fast replacement for Node's `crypto` module.
- `buffer`: Node.js `Buffer` implementation for the browser/RN.
- `stream-browserify`: Node.js `stream` implementation.
- `process`: Node.js `process` implementation.

## Configuration

### 1. Create a Polyfill File

Create a file named `polyfills.js` (or `.ts`) in your project root:

```javascript
// polyfills.js
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
import process from 'process';

global.Buffer = Buffer;
global.process = process;

// Map crypto if needed (some libraries look for global.crypto)
if (typeof global.crypto !== 'object') {
  global.crypto = require('react-native-quick-crypto');
}
```

Import this file at the very top of your `index.js` or `App.js`:

```javascript
import './polyfills';
import { AppRegistry } from 'react-native';
import App from './App';
// ...
```

### 2. Configure Metro (Recommended)

To ensure all dependencies (including `@stellar/stellar-sdk`) correctly resolve Node.js modules to their polyfills, update your `metro.config.js`:

```javascript
const { getDefaultConfig } = require('expo/metro-config'); // Or 'metro-config' if not using Expo

const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('react-native-quick-crypto'),
  buffer: require.resolve('buffer'),
  stream: require.resolve('stream-browserify'),
  process: require.resolve('process'),
};

module.exports = config;
```

### 3. Using with @stellar/stellar-sdk

The Axionvera SDK relies on `@stellar/stellar-sdk`. By polyfilling `Buffer` and `crypto` as shown above, `stellar-sdk` will function correctly on both iOS and Android.

## Troubleshooting

### "Buffer not found"
Ensure `global.Buffer = Buffer` is executed before any other imports in your entry point.

### "Could not locate a native crypto implementation"
This usually happens if `react-native-get-random-values` is not imported at the very top of your app. It must be the first import.

### Expo Managed Workflow
If you are using Expo Managed Workflow, ensure you have ran `npx expo prebuild` or are using a development client, as `react-native-quick-crypto` and `react-native-get-random-values` contain native code.
