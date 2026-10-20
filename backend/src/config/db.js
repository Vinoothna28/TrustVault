const mongoose = require('mongoose');

/**
 * Connect to MongoDB instance using URI from environment variables.
 * Handles production MongoDB Atlas connection and local fallback.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/trustvault';

  // Sanitize URI for safe console logging (strip credentials)
  const sanitizedUri = mongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@');

  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 5000,
      autoIndex: true
    });

    console.log(`[TrustVault Database] Connected to MongoDB: ${conn.connection.host} (${sanitizedUri})`);
    return conn;
  } catch (error) {
    console.error(`[TrustVault Database ERROR] Connection failed: ${error.message}`);
    if (process.env.NODE_ENV !== 'test') {
      console.error('[TrustVault Database ERROR] Verify that MONGODB_URI is set properly in .env or Render Dashboard.');
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
