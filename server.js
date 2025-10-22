const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./utils/db");
const ResponseHelper = require("./utils/responseHelper");

dotenv.config();
const app = express()

app.use(express.json());

// const allowedOrigins = ["*",
//   "http://localhost:5173",
//   //"http://localhost:5174",
//   "https://restaurantmenu-five.vercel.app"
// ];
app.use(
  cors({
    origin: '*',
  })
);

// app.use(cors({
//   origin: function(origin, callback) {
//     // Allow requests with no origin (like mobile apps, curl), or whitelisted origin
//     if (!origin || allowedOrigins.includes(origin)) {
//       callback(null, true);
//     } else {
//       callback(new Error("Not allowed by CORS"));
//     }
//   },
//   credentials: true, // allow cookies, authorization headers, etc.
// }));


// Middleware → ensure DB connected for each request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err); // pass to error handler
  }
});

// Routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/restaurants", require("./routes/restaurantRoutes"));
app.use("/api/templates", require("./routes/templateRoutes"));

// Root
app.get("/", (req, res) => {
  return ResponseHelper.success(res, null, "🍴 Restaurant App Backend is running 🚀");
});

/* ============================
   ✅ Global Error Handler
   ============================ */
app.use((err, req, res, next) => {
  console.error("🔥 Error caught by middleware:", err);

  // Mongoose-specific errors
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

  // JWT / Auth errors
  if (err.name === "JsonWebTokenError") {
    return ResponseHelper.error(res, "Invalid token", 401);
  }

  if (err.name === "TokenExpiredError") {
    return ResponseHelper.error(res, "Token expired", 401);
  }

  // Default
  return ResponseHelper.error(
    res,
    err.message || "Internal Server Error",
    err.status || 500
  );
});

// Start server
app.listen(process.env.PORT || 5000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`);
});

module.exports = app;
