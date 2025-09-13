const express = require("express");
const router = express.Router();
const { 
  register, 
  login, 
  verifyUser, 
  sendEmailOTP, 
  verifyEmailOTP, 
  resendEmailOTP 
} = require("../controllers/authController");
const authenticateToken = require("../middleware/authMiddleware");

// Existing authentication routes
router.post("/register", register);
router.post("/login", login);
router.get("/verify", authenticateToken, verifyUser);

// Email OTP verification routes
router.post("/send-email-otp", sendEmailOTP);
router.post("/verify-email-otp", verifyEmailOTP);
router.post("/resend-email-otp", resendEmailOTP);

// Optional: Health check route for OTP service
router.get("/otp-service/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "OTP service is running",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
