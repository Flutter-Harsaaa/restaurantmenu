const express = require("express");
const router = express.Router();
const { registerUser, loginUser, verifyUser } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

// Public routes (no token required)
router.post("/register", registerUser);
router.post("/login", loginUser);

// Protected route (token required)
router.get("/verify", authMiddleware, verifyUser);

module.exports = router;
