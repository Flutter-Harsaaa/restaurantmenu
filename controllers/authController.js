const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Registration = require("../models/Registration");
const Login = require("../models/Login");
//commit
// Register Admin
exports.register = async (req, res) => {
  try {
    const { fullName, email, contactNumber, restaurantName, password } = req.body;

    if (!fullName || !email || !contactNumber || !password) {
      return res.status(400 ).json({ msg: "Missing required fields" });
    }

    // Check if email already exists in Registration or Login
    const existingReg = await Registration.findOne({ email });
    const existingLogin = await Login.findOne({ email });
    if (existingReg || existingLogin) {
      return res.status(400).json({ msg: "Email already registered" });
    }

    // Create registration record
    const registration = await Registration.create({
      fullName,
      email,
      contactNumber,
      restaurantName,
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create login record (sync with registration)
    await Login.create({
      email,
      password: hashedPassword,
      isVerified: registration.isVerified,
      isActive: registration.isActive,
    });

    res.status(201).json({ msg: "Admin registered successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Login Admin
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ msg: "Email and password required" });

    const loginUser = await Login.findOne({ email });
    if (!loginUser) return res.status(400).json({ msg: "Invalid credentials" });

    // Check password
    const isMatch = await bcrypt.compare(password, loginUser.password);
    if (!isMatch) return res.status(400).json({ msg: "Invalid credentials" });

    // Check verification + active status
    if (!loginUser.isVerified) {
      return res.status(403).json({ msg: "Account not verified" });
    }
    if (loginUser.isActive !== 1) {
      return res.status(403).json({ msg: "Account is inactive" });
    }

    // Generate JWT
    const token = jwt.sign(
      { email: loginUser.email, id: loginUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ 
      token, 
      user: { email: loginUser.email, isVerified: loginUser.isVerified, isActive: loginUser.isActive }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Verify Token
exports.verifyUser = async (req, res) => {
  try {
    res.json({
      email: req.user.email,
      msg: "Token is valid"
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};