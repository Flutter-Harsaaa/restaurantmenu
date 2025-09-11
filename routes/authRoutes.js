const express = require("express");
const router = express.Router();
const { register, login, verifyUser } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/register", register);
router.post("/login", login);
router.get("/verify", authMiddleware, verifyUser);

module.exports = router;
