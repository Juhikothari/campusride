const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Manual .env loader — fixes dotenv v17 Windows issue
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
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/freewheels';
  try {
    await mongoose.connect(uri);
    console.log('✅ MongoDB Connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('');
    console.error('👉 FIX: Make sure MongoDB is running on your computer.');
    console.error('   Download: https://www.mongodb.com/try/download/community');
    console.error('   After installing, start it with: net start MongoDB  (Windows)');
    console.error('   Or run: mongod  in a separate terminal');
    console.error('');
    // Retry after 5 seconds instead of crashing
    console.log('⏳ Retrying MongoDB connection in 5 seconds...');
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;
