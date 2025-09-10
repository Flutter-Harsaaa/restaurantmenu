const express = require("express");
const { registerUser, loginUser, verifyUser } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/verify", authMiddleware, verifyUser);  // ✅ new route

module.exports = router;
