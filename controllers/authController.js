const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Registration = require("../models/Registration");
const Login = require("../models/Login");
const ResponseHelper = require("../utils/responseHelper"); // Import your ResponseHelper

// Register Admin
exports.register = async (req, res) => {
  try {
    const { name, email, contactNumber, restaurantName, password } = req.body;

    // Validation check
    if (!name || !email || !contactNumber || !password) {
      return ResponseHelper.error(res, "Missing required fields: name, email, contactNumber, and password are required", 400);
    }

    // Check if email already exists in Registration or Login
    const existingReg = await Registration.findOne({ email });
    const existingLogin = await Login.findOne({ email });
    
    if (existingReg || existingLogin) {
      return ResponseHelper.error(res, "Email already registered. Please use a different email address", 400);
    }

    // Create registration record
    const registration = await Registration.create({
      name: name, 
      email,
      contactNumber,
      restaurantName,
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create login record (sync with registration)
    const loginRecord = await Login.create({
      email,
      password: hashedPassword,
      isVerified: registration.isVerified,
      isActive: registration.isActive,
    });

    // Prepare success response data
    const responseData = {
      user: {
        id: registration._id,
        name: registration.name,
        email: registration.email,
        contactNumber: registration.contactNumber,
        restaurantName: registration.restaurantName,
        isVerified: registration.isVerified,
        isActive: registration.isActive,
        createdAt: registration.createdAt,
        updatedAt: registration.updatedAt,
        role:registration.role
      },
      loginId: loginRecord._id
    };

    return ResponseHelper.success(res, responseData, "Admin registered successfully", 201);

  } catch (err) {
    // Handle duplicate key error specifically
    if (err.code === 11000) {
      return ResponseHelper.error(res, "Email already exists in the system", 400);
    }
    
    return ResponseHelper.error(res, "Internal server error during registration", 500);
  }
};

// Login Admin
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return ResponseHelper.error(res, "Email and password are required", 400);
    }

    const loginUser = await Login.findOne({ email });
    if (!loginUser) {
      return ResponseHelper.error(res, "Invalid credentials", 400);
    }

    const isMatch = await bcrypt.compare(password, loginUser.password);
    if (!isMatch) {
      return ResponseHelper.error(res, "Invalid credentials", 400);
    }

    // if (!loginUser.isVerified) {
    //   return ResponseHelper.error(res, "Account not verified. Please verify your email first", 403);
    // }  some technical changes made it to comment in future may require

    if (loginUser.isActive !== 1) {
      return ResponseHelper.error(res, "Account is inactive. Please contact support", 403);
    }

    const token = jwt.sign(
      { email: loginUser.email, id: loginUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    const userData = {
      token,
      user: {
        id: loginUser._id,
        email: loginUser.email,
        isVerified: loginUser.isVerified,
        isActive: loginUser.isActive,
        isSetup: loginUser.isSetup,
        resId: loginUser.resId
      }
    };

    return ResponseHelper.success(res, userData, "Login successful", 200);

  } catch (err) {
    return ResponseHelper.error(res, "Internal server error", 500);
  }
};

// Verify Token
exports.verifyUser = async (req, res) => {
  try {
    // At this point, req.user is already populated by the middleware
    // Get full user details from database
    const user = await Login.findOne({ email: req.user.email })
      .populate('resId', 'name address') // Populate restaurant details if needed
      .select('-password'); // Exclude password from response

    if (!user) {
      return ResponseHelper.error(res, "User not found in database", 404);
    }

    // Check if user is still active
    if (user.isActive !== 1) {
      return ResponseHelper.error(res, "User account is inactive", 403);
    }

    // Check if user is verified
    // if (!user.isVerified) {
    //   return ResponseHelper.error(res, "User account is not verified", 403);
    // }  due to technical changes this is comment out may future need it

    // Prepare response data
    const userData = {
      user: {
        id: user._id,
        email: user.email,
        isVerified: user.isVerified,
        isActive: user.isActive,
        isSetup: user.isSetup,
        resId: user.resId,
        tokenValidatedAt: new Date().toISOString()
      },
      tokenInfo: {
        createdAt: new Date(req.user.iat * 1000).toISOString(),
        expiresAt: new Date(req.user.exp * 1000).toISOString(),
        timeToExpiry: Math.max(0, req.user.exp * 1000 - Date.now()) // milliseconds until expiry
      }
    };

    return ResponseHelper.success(res, userData, "Token is valid and user is authenticated", 200);

  } catch (err) {
    return ResponseHelper.error(res, "Internal server error during user verification", 500);
  }
};
