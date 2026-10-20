require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');

const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas or local MongoDB instance
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`[TrustVault Server] Running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    console.log(`[TrustVault Server] Health check available at: http://localhost:${PORT}/api/health`);
  });
}).catch((err) => {
  console.error(`[TrustVault Server FATAL] Database connection could not be established: ${err.message}`);
  process.exit(1);
});
