const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Manual .env loader — fixes dotenv Windows line issues
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  const isProd = process.env.NODE_ENV === 'production';
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;

  if (isProd) {
    if (!uri) {
      console.error('FATAL: MONGODB_URI environment variable is required in production. Failing closed.');
      process.exit(1);
    }
    const mongoUriRegex = /^mongodb(\+srv)?:\/\//;
    if (!mongoUriRegex.test(uri)) {
      console.error('FATAL: MONGODB_URI has an invalid format. Must start with mongodb:// or mongodb+srv://');
      process.exit(1);
    }
  }

  const connectionUri = uri || 'mongodb://localhost:27017/freewheels';
  const sanitizedUri = connectionUri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@');

  const options = {
    maxPoolSize: 50,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  };

  try {
    await mongoose.connect(connectionUri, options);
    console.log(`✅ MongoDB Connected successfully`);
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    if (isProd) {
      console.error('FATAL: Production database connection failed. Server will fail closed.');
      process.exit(1);
    }
    throw error;
  }
};

module.exports = connectDB;
