const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.error("❌ ERROR: MONGO_URI is not defined in the environment variables.");
      process.exit(1);
    }

    console.log("🔥 Attempting to connect to MongoDB...");

    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB connected → ${conn.connection.host}`);
  } catch (err) {
    console.error("❌ FULL ERROR CONNECTING TO MONGODB →", err.message);
    console.error(err);
    process.exit(1);
  }
};

module.exports = connectDB;