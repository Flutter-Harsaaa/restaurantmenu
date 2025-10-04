// utils/db.js
const mongoose = require("mongoose");

const MAX_RETRIES = 5; // how many times to retry
const INITIAL_DELAY = 500; // ms (0.5s)

// Sleep helper
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function connectWithRetry(retries = MAX_RETRIES, delayMs = INITIAL_DELAY) {
  if (mongoose.connection.readyState === 1) {
    // ✅ Already connected
    return mongoose.connection;
  }

  if (mongoose.connection.readyState === 2) {
    // ⏳ Already connecting
    return mongoose.connection.asPromise();
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const conn = await mongoose.connect(process.env.MONGO_URI, {
        dbName: "test", // change if needed
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log("✅ MongoDB Connected");
      return conn;
    } catch (err) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, err.message);

      if (attempt < retries) {
        const waitTime = delayMs * Math.pow(2, attempt - 1); // exponential backoff
        console.log(`⏳ Retrying in ${waitTime / 1000}s...`);
        await delay(waitTime);
      } else {
        console.error("🚨 All connection attempts failed.");
        throw err;
      }
    }
  }
}

module.exports = connectWithRetry;
