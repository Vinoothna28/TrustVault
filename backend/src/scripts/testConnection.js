require('dotenv').config();
const mongoose = require('mongoose');

async function testConnection() {
  const rawUri = process.env.MONGODB_URI;

  console.log('\n======================================================');
  console.log('       TrustVault Database Connection Diagnostic      ');
  console.log('======================================================\n');

  if (!rawUri) {
    console.error('❌ ERROR: MONGODB_URI is not set in backend/.env!');
    console.log('👉 Please open backend/.env and set MONGODB_URI=your_connection_string');
    process.exit(1);
  }

  // Sanitize URI for safe console printing (masks username and password)
  const sanitizedUri = rawUri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:********@');
  console.log(`Target URI: ${sanitizedUri}`);

  const isAtlas = rawUri.includes('mongodb+srv://') || rawUri.includes('mongodb.net');
  console.log(`Cluster Type: ${isAtlas ? '☁️  MongoDB Atlas (Cloud)' : '💻 Local MongoDB'}`);

  console.log('\nAttempting connection (timeout in 8 seconds)...');

  const startTime = Date.now();
  try {
    const conn = await mongoose.connect(rawUri, {
      serverSelectionTimeoutMS: 8000
    });

    const latency = Date.now() - startTime;
    console.log('\n✅ SUCCESS: Successfully connected to MongoDB!');
    console.log(`   Host        : ${conn.connection.host}`);
    console.log(`   Database    : ${conn.connection.name}`);
    console.log(`   Ping Latency: ${latency} ms`);
    console.log('\n🎉 Your database is fully configured and ready for TrustVault.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    const latency = Date.now() - startTime;
    console.error(`\n❌ CONNECTION FAILED (${latency} ms):`);
    console.error(`   ${err.message}\n`);

    console.log('🔍 Common Troubleshooting Steps:');
    if (err.message.includes('bad auth') || err.message.includes('Authentication failed')) {
      console.log('   1. [Bad Credentials]: Check your Atlas username and password in the URI.');
      console.log('      Note: Special characters in your password (like @, #, $, %) must be URL-encoded.');
    } else if (err.message.includes('ETIMEDOUT') || err.message.includes('Server selection timed out') || err.message.includes('querySrv')) {
      console.log('   1. [Network Access / IP Whitelist]: In MongoDB Atlas, go to "Network Access"');
      console.log('      and ensure your current IP or "0.0.0.0/0" (Allow access from anywhere) is added.');
      console.log('   2. [DNS/Firewall]: If on a corporate VPN, DNS SRV queries might be blocked.');
    } else {
      console.log('   1. Verify your connection string format:');
      console.log('      mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/trustvault?retryWrites=true&w=majority');
    }
    console.log('\n======================================================\n');
    process.exit(1);
  }
}

testConnection();
