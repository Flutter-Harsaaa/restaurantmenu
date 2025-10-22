const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./utils/db");
const ResponseHelper = require("./utils/responseHelper");
const http = require("http");
const { Server } = require("socket.io");

dotenv.config();
const app = express();

// Create HTTP server wrapper for Express
const server = http.createServer(app);

// Configure Socket.io
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for flexibility
    // origin: [
    //   "http://localhost:5173",
    //   "https://restaurantmenu-five.vercel.app"
    // ],
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Setup event listeners for socket connections
io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // Listen for table updates or future real-time events
  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

// Make io accessible to all controllers
app.set("io", io);

// Middleware
app.use(express.json());

// Enable CORS
app.use(
  cors({
    origin: "*", // Allow all origins for flexibility
  })
);

// Database connection middleware
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// Routes (All your REST APIs)
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/restaurants", require("./routes/restaurantRoutes"));
app.use("/api/templates", require("./routes/templateRoutes"));

// Root route
app.get("/", (req, res) => {
  return ResponseHelper.success(res, null, "🍴 Restaurant App Backend is running 🚀");
});

/* ============================
   ✅ Global Error Handler
   ============================= */
app.use((err, req, res, next) => {
  console.error("🔥 Error caught by middleware:", err);

  if (err.name === "MongoNetworkError") {
    return ResponseHelper.error(
      res,
      "Database temporarily unavailable. Please try again later.",
      503
    );
  }

  if (err.name === "ValidationError") {
    return ResponseHelper.error(res, "Validation failed", 400, err.errors);
  }

  if (err.name === "JsonWebTokenError") {
    return ResponseHelper.error(res, "Invalid token", 401);
  }

  if (err.name === "TokenExpiredError") {
    return ResponseHelper.error(res, "Token expired", 401);
  }

  return ResponseHelper.error(
    res,
    err.message || "Internal Server Error",
    err.status || 500
  );
});

/* ============================
   ✅ Start Server (Socket enabled + REST)
   ============================= */
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = { app, io };
