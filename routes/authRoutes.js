const express = require("express");
const router = express.Router();
const { register, login, verifyUser } = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/verify", authenticateToken, verifyUser);

module.exports = router;