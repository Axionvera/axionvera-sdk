# Performance Benchmarks

This directory contains automated performance benchmarks for the Axionvera SDK, specifically focused on XDR parsing performance.

## Purpose

The benchmarks are designed to guarantee that new features added to the SDK don't accidentally slow down transaction parsing, which would cause UI stuttering in applications using the SDK.

## Benchmarks

### XDR Parsing Benchmarks

The main benchmark script (`xdr-parsing.benchmark.js`) tests the following operations:

1. **Transaction.fromXDR()** - Parsing complex Soroban transactions from XDR
2. **XDR toBase64()** - Converting XDR to base64 strings
3. **Transaction.hash()** - Calculating transaction hashes
4. **Full Parse + Hash + Serialize Cycle** - Complete transaction processing
5. **Bulk Parse 100 Transactions** - Parsing multiple transactions in batch

### Test Data

The benchmarks generate 1,000 complex Soroban transactions with:
- Multiple contract call operations
- Complex arguments (maps, vectors, addresses, numbers)
- Varying fees and timeouts
- Memos and metadata

## Running Benchmarks

### Local Development

```bash
# Install dependencies
cd benchmarks
npm install

# Run benchmarks
npm run benchmark

# Run benchmarks in CI mode (outputs machine-readable results)
npm run benchmark:ci
```

### CI/CD Integration

The benchmarks automatically run on GitHub Actions for:
- Pull requests to main/develop branches
- Pushes to main/develop branches

## Performance Thresholds

- **Minimum Transaction Parsing:** 1,000 ops/sec
- **Performance Regression Alert:** 10% increase in parsing time
- **CI Failure:** Parsing below threshold triggers build failure

## Benchmark Results

### Sample Output

```
🚀 Starting XDR Parsing Performance Benchmarks...

Generated 1000 complex Soroban transactions for benchmarking

Transaction.fromXDR() - Complex Transactions         1,234.56 ops/sec ±  2.34% (   0.81ms/op)
XDR toBase64() - Complex Transactions                2,456.78 ops/sec ±  1.23% (   0.41ms/op)
Transaction.hash() - Complex Transactions           1,890.12 ops/sec ±  1.89% (   0.53ms/op)
Full Parse + Hash + Serialize Cycle                  890.34 ops/sec ±  3.45% (   1.12ms/op)
Bulk Parse 100 Transactions                          8.90 ops/sec ±  2.78% ( 112.36ms/op)

✅ Benchmark suite completed!

📊 Summary:
   Total benchmark time: 115.23ms
   Average operations/sec: 1,654.54
   Fastest benchmark: XDR toBase64() - Complex Transactions
   Slowest benchmark: Bulk Parse 100 Transactions

🎯 Critical Metric - Transaction Parsing: 1,234.56 ops/sec
✅ Transaction parsing performance is acceptable
```

## CI Integration

The GitHub Actions workflow:

1. Runs benchmarks on every PR and push
2. Extracts key metrics (parsing performance, total time)
3. Posts results as PR comments
4. Fails build if performance regression detected
5. Uploads detailed results as artifacts

### PR Comments Example

```
## 🚀 Performance Benchmark Results

**Transaction Parsing Performance:** 1,234.56 ops/sec
**Total Benchmark Time:** 115.23ms
**Performance Status:** ✅ PASS - Acceptable

### ✅ Performance is acceptable

No significant performance regression detected.

---
*This automated benchmark tests XDR parsing performance with 1,000 complex Soroban transactions. If parsing time increases by more than 10%, please review for performance issues.*
```

## Adding New Benchmarks

To add new benchmarks:

1. Create a new benchmark file in this directory
2. Follow the naming convention: `[feature].benchmark.js`
3. Use the Benchmark.js library
4. Add CI integration in the workflow if needed
5. Update this README

## Performance Guidelines

When contributing to the SDK:

1. **Run benchmarks locally** before submitting PRs
2. **Monitor performance impact** of new features
3. **Optimize critical paths** in XDR processing
4. **Document performance characteristics** of new APIs
5. **Consider lazy loading** for heavy operations

## Troubleshooting

### Common Issues

1. **Module not found errors:** Ensure dependencies are installed in benchmarks directory
2. **Inconsistent results:** Run benchmarks multiple times and average results
3. **CI failures:** Check if performance regression is real or noise

### Debug Mode

Enable debug output by setting environment variable:

```bash
DEBUG=benchmarks npm run benchmark
```

## Architecture

The benchmark suite uses:
- **Benchmark.js** for performance measurement
- **Stellar SDK** for XDR operations
- **GitHub Actions** for CI automation
- **Custom test data generators** for realistic scenarios
