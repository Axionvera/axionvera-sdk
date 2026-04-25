const Benchmark = require('benchmark');
const { TransactionBuilder, xdr } = require('@stellar/stellar-sdk');

/**
 * Performance benchmarks for XDR parsing in the Axionvera SDK.
 * 
 * This script parses 1,000 complex Soroban transaction XDRs to ensure
 * that new features don't accidentally slow down transaction parsing.
 */

// Generate sample complex Soroban transactions for benchmarking
function generateComplexTransactions(count) {
  const transactions = [];
  const networkPassphrase = "Test SDF Network ; September 2015";
  
  for (let i = 0; i < count; i++) {
    // Create a source account
    const sourceAccount = {
      accountId: `G${'A'.repeat(56)}`, // Mock public key
      sequence: i.toString(),
    };
    
    // Create a complex transaction with multiple operations
    const builder = new TransactionBuilder(sourceAccount, {
      fee: (100000 + i * 1000).toString(),
      networkPassphrase
    });
    
    // Add multiple contract call operations
    for (let j = 0; j < 5; j++) {
      const contractId = `C${'B'.repeat(63)}${j}`; // Mock contract ID
      const contract = new Contract(contractId);
      
      // Create complex arguments
      const args = [
        xdr.ScVal.scvString(`method_${j}_${i}`),
        xdr.ScVal.scvU64(BigInt(i * 1000000)),
        xdr.ScVal.scvMap([
          new xdr.MapEntry({
            key: xdr.ScVal.scvSymbol("key1"),
            val: xdr.ScVal.scvString(`value1_${i}`)
          }),
          new xdr.MapEntry({
            key: xdr.ScVal.scvSymbol("key2"),
            val: xdr.ScVal.scvU32(j)
          })
        ]),
        xdr.ScVal.scvVec([
          xdr.ScVal.scvU32(1),
          xdr.ScVal.scvU32(2),
          xdr.ScVal.scvU32(3),
          xdr.ScVal.scvBool(true),
          xdr.ScVal.scvAddress(new xdr.ScAddress.scAddressTypeContract(Buffer.alloc(32, i)))
        ])
      ];
      
      builder.addOperation(contract.call(`complex_method_${j}`, ...args));
    }
    
    // Add memo
    builder.addMemo(`Complex transaction ${i} with multiple operations`);
    
    // Set timeout
    builder.setTimeout(300 + i);
    
    const tx = builder.build();
    transactions.push(tx.toXDR());
  }
  
  return transactions;
}

// Benchmark suite
function runBenchmarks() {
  console.log('🚀 Starting XDR Parsing Performance Benchmarks...\n');
  
  const transactionCount = 1000;
  const transactions = generateComplexTransactions(transactionCount);
  
  console.log(`Generated ${transactionCount} complex Soroban transactions for benchmarking\n`);
  
  const suite = new Benchmark.Suite();
  
  // Benchmark 1: Transaction parsing from XDR
  suite.add('Transaction.fromXDR() - Complex Transactions', {
    defer: true,
    fn: function(deferred) {
      const tx = transactions[Math.floor(Math.random() * transactions.length)];
      TransactionBuilder.fromXDR(tx, "Test SDF Network ; September 2015");
      deferred.resolve();
    }
  });
  
  // Benchmark 2: XDR to string conversion
  suite.add('XDR toBase64() - Complex Transactions', {
    defer: true,
    fn: function(deferred) {
      const tx = transactions[Math.floor(Math.random() * transactions.length)];
      Buffer.from(tx, 'base64').toString();
      deferred.resolve();
    }
  });
  
  // Benchmark 3: Transaction hash calculation
  suite.add('Transaction.hash() - Complex Transactions', {
    defer: true,
    fn: function(deferred) {
      const tx = TransactionBuilder.fromXDR(
        transactions[Math.floor(Math.random() * transactions.length)],
        "Test SDF Network ; September 2015"
      );
      tx.hash();
      deferred.resolve();
    }
  });
  
  // Benchmark 4: Full parse + hash + serialize cycle
  suite.add('Full Parse + Hash + Serialize Cycle', {
    defer: true,
    fn: function(deferred) {
      const xdrData = transactions[Math.floor(Math.random() * transactions.length)];
      const tx = TransactionBuilder.fromXDR(xdrData, "Test SDF Network ; September 2015");
      tx.hash();
      tx.toXDR();
      deferred.resolve();
    }
  });
  
  // Benchmark 5: Bulk parsing of 100 transactions
  suite.add('Bulk Parse 100 Transactions', {
    defer: true,
    fn: function(deferred) {
      const batchSize = 100;
      const startIndex = Math.floor(Math.random() * (transactions.length - batchSize));
      const batch = transactions.slice(startIndex, startIndex + batchSize);
      
      batch.forEach(xdrData => {
        TransactionBuilder.fromXDR(xdrData, "Test SDF Network ; September 2015");
      });
      
      deferred.resolve();
    }
  });
  
  // Run the benchmark suite
  suite
    .on('cycle', function(event) {
      const benchmark = event.target;
      const opsPerSec = benchmark.hz.toFixed(2);
      const avgTime = (benchmark.stats.mean * 1000).toFixed(2);
      const margin = (benchmark.stats.rme * 100).toFixed(2);
      
      console.log(`${benchmark.name.padEnd(50)} ${opsPerSec.padStart(12)} ops/sec ±${margin.padStart(6)}% (${avgTime.padStart(8)}ms/op)`);
    })
    .on('complete', function() {
      console.log('\n✅ Benchmark suite completed!\n');
      
      // Calculate total time for all benchmarks
      const totalTime = suite.reduce((sum, benchmark) => sum + benchmark.stats.mean, 0);
      const totalOps = suite.reduce((sum, benchmark) => sum + benchmark.hz, 0);
      
      console.log(`📊 Summary:`);
      console.log(`   Total benchmark time: ${(totalTime * 1000).toFixed(2)}ms`);
      console.log(`   Average operations/sec: ${(totalOps / suite.length).toFixed(2)}`);
      console.log(`   Fastest benchmark: ${suite.filter('fastest').map('name').join(', ')}`);
      console.log(`   Slowest benchmark: ${suite.filter('slowest').map('name').join(', ')}`);
      
      // Performance regression check
      const parseBenchmark = suite.filter(benchmark => benchmark.name.includes('Transaction.fromXDR()'))[0];
      if (parseBenchmark) {
        const opsPerSec = parseBenchmark.hz;
        console.log(`\n🎯 Critical Metric - Transaction Parsing: ${opsPerSec.toFixed(2)} ops/sec`);
        
        // Alert if performance is below threshold (adjust as needed)
        const threshold = 1000; // 1000 ops/sec minimum
        if (opsPerSec < threshold) {
          console.log(`⚠️  WARNING: Transaction parsing below threshold (${threshold} ops/sec)`);
          console.log('   This may indicate a performance regression!');
        } else {
          console.log(`✅ Transaction parsing performance is acceptable`);
        }
      }
      
      // CI mode output
      if (process.argv.includes('--ci')) {
        console.log('\n📋 CI Output:');
        suite.forEach(benchmark => {
          console.log(`benchmark_${benchmark.name.replace(/[^a-zA-Z0-9]/g, '_')}=${benchmark.hz.toFixed(2)}`);
        });
      }
    })
    .run({ async: true });
}

// Error handling
process.on('uncaughtException', (error) => {
  console.error('❌ Benchmark failed with error:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled promise rejection in benchmark:', reason);
  process.exit(1);
});

// Run benchmarks if this script is executed directly
if (require.main === module) {
  runBenchmarks();
}

module.exports = { runBenchmarks, generateComplexTransactions };
