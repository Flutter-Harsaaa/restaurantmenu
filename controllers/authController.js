const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Registration = require("../models/Registration");
const mongoose = require("mongoose");
const Login = require("../models/Login");
const nodemailer = require('nodemailer');
const ResponseHelper = require("../utils/responseHelper"); // Import your ResponseHelper
const { tokenBlacklist } = require("../middleware/authMiddleware");
const TokenBlacklist = require("../models/TokenBlacklist");
// const { tokenBlacklist } = require("../middleware/authMiddleware");
// const TokenBlacklist = require("../models/TokenBlacklist");

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
        role: registration.role
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


// Email OTP Controllers

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

// Email transporter setup with better error handling
const createTransporter = () => {
  try {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } catch (error) {
    console.error('Email transporter setup failed:', error);
    throw new Error('Email service configuration error');
  }
};

// Generate secure 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Validate email format
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Rate limiting helper
const checkRateLimit = (email, windowMs = 60000) => {
  const lastOTP = otpStore.get(email);
  if (lastOTP && (Date.now() - (lastOTP.expiry - 5 * 60 * 1000)) < windowMs) {
    return false;
  }
  return true;
};

// Send Email OTP Controller
exports.sendEmailOTP = async (req, res) => {
  try {
    const { token } = req.body;

    // Validate required fields
    if (!token) {
      return ResponseHelper.error(res, 'Access token is required', 400);
    }

    // Extract and validate JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return ResponseHelper.error(res, 'Token has expired. Please login again', 401);
      }
      if (error.name === 'JsonWebTokenError') {
        return ResponseHelper.error(res, 'Invalid token provided', 401);
      }
      return ResponseHelper.error(res, 'Token verification failed', 401);
    }

    const email = decoded.email;
    if (!email) {
      return ResponseHelper.error(res, 'Email not found in token', 400);
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return ResponseHelper.error(res, 'Invalid email format', 400);
    }

    // Check rate limiting
    if (!checkRateLimit(email)) {
      return ResponseHelper.error(res, 'Please wait 1 minute before requesting a new OTP', 429);
    }

    // Generate OTP and set expiry
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    // Store OTP with metadata
    otpStore.set(email, {
      otp: otp,
      expiry: otpExpiry,
      attempts: 0,
      createdAt: Date.now()
    });

    // Create email content
    const mailOptions = {
      from: `"Vernora Tech Restaurant" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Email Verification - Vernora Tech Restaurant',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #007bff; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">Email Verification</h1>
            </div>
            <div style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Thank you for registering with Vernora Tech Restaurant. Please use the following OTP to verify your email address:
              </p>
              <div style="background-color: #f8f9fa; border: 2px dashed #007bff; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; color: #007bff; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
              </div>
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>Important:</strong> This OTP will expire in 5 minutes for security reasons.
                </p>
              </div>
              <p style="color: #666; font-size: 14px; line-height: 1.5;">
                If you didn't request this verification, please ignore this email or contact our support team if you have concerns.
              </p>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Vernora Tech Restaurant. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Send email
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);

    // Mask email for response
    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    return ResponseHelper.success(res, {
      email: maskedEmail,
      expiresIn: '5 minutes'
    }, 'OTP sent successfully to your email', 200);

  } catch (error) {
    console.error('Send OTP Error:', error);
    return ResponseHelper.error(res, 'Failed to send OTP. Please try again later', 500);
  }
};

// Verify Email OTP Controller
exports.verifyEmailOTP = async (req, res) => {
  try {
    const { token, otp } = req.body;

    // Validate required fields
    if (!token || !otp) {
      return ResponseHelper.error(res, 'Token and OTP are required', 400);
    }

    // Validate OTP format
    if (!/^\d{6}$/.test(otp)) {
      return ResponseHelper.error(res, 'OTP must be a 6-digit number', 400);
    }

    // Extract and validate JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return ResponseHelper.error(res, 'Token has expired. Please login again', 401);
      }
      return ResponseHelper.error(res, 'Invalid token provided', 401);
    }

    const email = decoded.email;

    // Check if OTP exists
    const storedOTP = otpStore.get(email);
    if (!storedOTP) {
      return ResponseHelper.error(res, 'OTP not found. Please request a new OTP', 400);
    }

    // Check OTP expiry
    if (Date.now() > storedOTP.expiry) {
      otpStore.delete(email);
      return ResponseHelper.error(res, 'OTP has expired. Please request a new OTP', 400);
    }

    // Check attempt limit
    if (storedOTP.attempts >= 3) {
      otpStore.delete(email);
      return ResponseHelper.error(res, 'Maximum verification attempts exceeded. Please request a new OTP', 400);
    }

    // Verify OTP
    if (storedOTP.otp !== otp.toString()) {
      storedOTP.attempts += 1;
      otpStore.set(email, storedOTP);

      return ResponseHelper.error(res,
        `Invalid OTP. ${3 - storedOTP.attempts} attempt${3 - storedOTP.attempts !== 1 ? 's' : ''} remaining`,
        400
      );
    }

    // OTP verified successfully - Update database
    try {
      const updatePromises = [];

      // Update Registration collection if exists
      const registrationUpdate = Registration.findOneAndUpdate(
        { email: email },
        {
          isVerified: true,
          emailVerifiedAt: new Date()
        },
        { new: true }
      );
      updatePromises.push(registrationUpdate);

      // Update Login collection if exists
      const loginUpdate = Login.findOneAndUpdate(
        { email: email },
        {
          isVerified: true,
          emailVerifiedAt: new Date()
        },
        { new: true }
      );
      updatePromises.push(loginUpdate);

      const [registrationResult, loginResult] = await Promise.all(updatePromises);

      // Clear OTP from memory
      otpStore.delete(email);

      return ResponseHelper.success(res, {
        email: email,
        isVerified: true,
        verifiedAt: new Date().toISOString(),
        updatedCollections: {
          registration: !!registrationResult,
          login: !!loginResult
        }
      }, 'Email verified successfully', 200);

    } catch (dbError) {
      console.error('Database Update Error:', dbError);
      // Clear OTP even if DB update fails
      otpStore.delete(email);
      return ResponseHelper.error(res, 'Email verified but failed to update database', 500);
    }

  } catch (error) {
    console.error('Verify OTP Error:', error);
    return ResponseHelper.error(res, 'Failed to verify OTP. Please try again', 500);
  }
};

// Resend Email OTP Controller
exports.resendEmailOTP = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return ResponseHelper.error(res, 'Access token is required', 400);
    }

    // Extract and validate JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return ResponseHelper.error(res, 'Token has expired. Please login again', 401);
      }
      return ResponseHelper.error(res, 'Invalid token provided', 401);
    }

    const email = decoded.email;

    // Check rate limiting (1 minute between requests)
    if (!checkRateLimit(email, 60000)) {
      return ResponseHelper.error(res, 'Please wait 1 minute before requesting a new OTP', 429);
    }

    // Generate new OTP
    const otp = generateOTP();
    const otpExpiry = Date.now() + 5 * 60 * 1000; // 5 minutes expiry

    // Store new OTP
    otpStore.set(email, {
      otp: otp,
      expiry: otpExpiry,
      attempts: 0,
      createdAt: Date.now()
    });

    // Email content for resend
    const mailOptions = {
      from: `"Vernora Tech Restaurant" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Resend: Email Verification OTP - Vernora Tech Restaurant',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Email Verification - Resent</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <div style="background-color: #28a745; padding: 30px 20px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">New Verification Code</h1>
            </div>
            <div style="padding: 40px 30px;">
              <p style="color: #333; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
                Here's your new verification code for Vernora Tech Restaurant:
              </p>
              <div style="background-color: #f8f9fa; border: 2px dashed #28a745; border-radius: 8px; padding: 25px; text-align: center; margin: 30px 0;">
                <div style="font-size: 36px; font-weight: bold; color: #28a745; letter-spacing: 5px; font-family: 'Courier New', monospace;">
                  ${otp}
                </div>
              </div>
              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 4px;">
                <p style="color: #856404; margin: 0; font-size: 14px;">
                  <strong>Note:</strong> This new OTP will expire in 5 minutes.
                </p>
              </div>
            </div>
            <div style="background-color: #f8f9fa; padding: 20px 30px; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; font-size: 12px; margin: 0; text-align: center;">
                © ${new Date().getFullYear()} Vernora Tech Restaurant. All rights reserved.
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    // Send email
    const transporter = createTransporter();
    await transporter.sendMail(mailOptions);

    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');

    return ResponseHelper.success(res, {
      email: maskedEmail,
      expiresIn: '5 minutes'
    }, 'New OTP sent successfully', 200);

  } catch (error) {
    console.error('Resend OTP Error:', error);
    return ResponseHelper.error(res, 'Failed to resend OTP. Please try again later', 500);
  }
};

// Optional: Clean up expired OTPs (call this periodically)
exports.cleanupExpiredOTPs = () => {
  const now = Date.now();
  for (const [email, otpData] of otpStore.entries()) {
    if (now > otpData.expiry) {
      otpStore.delete(email);
    }
  }
};

// Export the OTP store for testing purposes (optional)
if (process.env.NODE_ENV === 'test') {
  exports.otpStore = otpStore;
}


// Logout Controller - Multiple strategies
exports.logout = async (req, res) => {
  try {
    const token = req.token; // Get token from middleware
    const user = req.user;   // Get user from middleware

    if (!token) {
      return ResponseHelper.error(res, "No active session found", 400);
    }

    // Strategy 1: Add token to in-memory blacklist (Fast, but not persistent)
    tokenBlacklist.add(token);

    // Strategy 2: Add token to database blacklist (Persistent, but slower)
    // Calculate token expiry from JWT payload
    const tokenExpiry = new Date(user.exp * 1000);

    try {
      await TokenBlacklist.create({
        token: token,
        email: user.email,
        expiresAt: tokenExpiry
      });
    } catch (dbError) {
      // If database storage fails, continue with in-memory blacklisting
      console.warn('Failed to store token in database blacklist:', dbError.message);
    }

    // Prepare response data
    const responseData = {
      user: {
        email: user.email,
        id: user.id
      },
      logoutTime: new Date().toISOString(),
      tokenExpiry: tokenExpiry.toISOString(),
      message: "Session terminated successfully"
    };

    return ResponseHelper.success(res, responseData, "Logout successful. Please login again to continue", 200);

  } catch (error) {
    console.error('Logout Error:', error);
    return ResponseHelper.error(res, "Internal server error during logout", 500);
  }
};

// Logout from all devices - Blacklist all user tokens
exports.logoutAllDevices = async (req, res) => {
  try {
    const user = req.user;

    // Blacklist all tokens for this user (database approach)
    const result = await TokenBlacklist.updateMany(
      { email: user.email },
      {
        $setOnInsert: {
          token: "all_devices_" + user.email + "_" + Date.now(),
          email: user.email,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
        }
      },
      { upsert: true }
    );

    // Also blacklist current token
    tokenBlacklist.add(req.token);
    await TokenBlacklist.create({
      token: req.token,
      email: user.email,
      expiresAt: new Date(user.exp * 1000)
    });

    const responseData = {
      user: {
        email: user.email,
        id: user.id
      },
      devicesLoggedOut: result.modifiedCount + 1,
      logoutTime: new Date().toISOString(),
      message: "Logged out from all devices successfully"
    };

    return ResponseHelper.success(res, responseData, "Successfully logged out from all devices", 200);

  } catch (error) {
    console.error('Logout All Devices Error:', error);
    return ResponseHelper.error(res, "Internal server error during logout", 500);
  }
};

// Check logout status
exports.checkLogoutStatus = async (req, res) => {
  try {
    const token = req.headers.authorization?.slice(7);

    if (!token) {
      return ResponseHelper.success(res, {
        isLoggedOut: true,
        reason: "No token provided"
      }, "No active session", 200);
    }

    // Check if token is blacklisted
    const isBlacklisted = tokenBlacklist.has(token) ||
      await TokenBlacklist.findOne({ token });

    const responseData = {
      isLoggedOut: isBlacklisted,
      reason: isBlacklisted ? "Token has been revoked" : "Token is active",
      checkedAt: new Date().toISOString()
    };

    return ResponseHelper.success(res, responseData,
      isBlacklisted ? "Session has been terminated" : "Session is active", 200);

  } catch (error) {
    console.error('Check Logout Status Error:', error);
    return ResponseHelper.error(res, "Internal server error", 500);
  }
};

// Cleanup expired blacklisted tokens (run periodically)
exports.cleanupBlacklistedTokens = async () => {
  try {
    const result = await TokenBlacklist.deleteMany({
      expiresAt: { $lt: new Date() }
    });

    console.log(`Cleaned up ${result.deletedCount} expired blacklisted tokens`);
    return result.deletedCount;
  } catch (error) {
    console.error('Cleanup Error:', error);
    return 0;
  }
};

// exports.deleteUser = async (req, res) => {
//   const session = await mongoose.startSession();
  
//   try {
//     const { authHeader } = req.headers.authorization;
//      const token = authHeader.slice(7); // Remove 'Bearer ' prefix

//     // Validate required fields
//     if (!token) {
//       return ResponseHelper.error(res, 'Access token is required', 400);
//     }

//     // Extract and validate JWT token
//     let decoded;
//     try {
//       decoded = jwt.verify(token, process.env.JWT_SECRET);
//     } catch (error) {
//       if (error.name === 'TokenExpiredError') {
//         return ResponseHelper.error(res, 'Token has expired. Please login again', 401);
//       }
//       if (error.name === 'JsonWebTokenError') {
//         return ResponseHelper.error(res, 'Invalid token provided', 401);
//       }
//       return ResponseHelper.error(res, 'Token verification failed', 401);
//     }

//     const email = decoded.email;
//     if (!email) {
//       return ResponseHelper.error(res, 'Email not found in token', 400);
//     }

//     // Validate email format
//     if (!isValidEmail(email)) {
//       return ResponseHelper.error(res, 'Invalid email format', 400);
//     }

//     // Execute transaction
//     const result = await session.withTransaction(async () => {
//       // Check if restaurant exists and is active
//       const register = await Registration.findOne({
//         email: email,
//         isActive: { $ne: false }
//       }).session(session);

//       if (!register) {
//         throw new Error('USER_NOT_FOUND');
//       }

//       // Set isActive = false in Restaurant collection
//       const registerUpdate = await Registration.updateOne(
//         { email: email },
//         { 
//           $set: { 
//             isActive: 0,
//             deletedAt: new Date(),
//             updatedAt: new Date()
//           }
//         }
//       ).session(session);

//       // Set isSetup = 0 in Login collection using resId field
//       const login=await Login.findOne({ email: email }).session(session);{
//         console.log(login);
//       }
//       const loginUpdate = await Login.updateMany(
//         { email: email }, // ✅ Correct field name
//         { 
//           $set: { 
//             isActive: false,
//             updatedAt: new Date()
//           }
//         }
//       ).session(session);

//       return {
//         name: registerUpdate.name,
//         loginRecordsModified: loginUpdate.modifiedCount
//       };
//     });

//     // Success response
//     return ResponseHelper.success(res, {
//       userId: id,
//       name: result.name,
//       deletedAt: new Date().toISOString(),
//       loginRecordsUpdated: result.loginRecordsModified
//     }, "Restaurant successfully deleted (soft delete)", 200);

//   } catch (error) {
//     console.error('Error deleting restaurant:', error.message);

//     // Handle specific errors
//     if (error.message === 'USER_NOT_FOUND') {
//       return ResponseHelper.error(res, "Restaurant not found or already deleted", 404);
//     }

//     return ResponseHelper.error(res, "Internal server error while deleting restaurant", 500);

//   } finally {
//     // Always cleanup session
//     await session.endSession();
//   }
// };





// Update user profile details (registration collection)
exports.updateUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "User ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid user ID format", 400);
    }

    // Check if user exists in registration collection
    const existingUser = await Registration.findOne({
      _id: id,
      isActive: { $ne: false }
    });

    if (!existingUser) {
      return ResponseHelper.error(res, "User not found or has been deactivated", 404);
    }

    // Extract updatable fields from request body (excluding password)
    const {
      name,
      email,
      contactNumber
    } = req.body;

    // Check if email is being updated and if it already exists
    if (email && email !== existingUser.email) {
      const emailExists = await Registration.findOne({
        _id: { $ne: id },
        email: email,
        isActive: { $ne: false }
      });

      if (emailExists) {
        return ResponseHelper.error(res, "Email already exists for another user", 409);
      }

      // Also check in Login collection if email is used there
      const emailInLogin = await Login.findOne({
        email: email,
        _id: { $ne: existingUser._id }
      });

      if (emailInLogin) {
        return ResponseHelper.error(res, "Email already exists in login records", 409);
      }
    }

    // Check if phone is being updated and if it already exists
    if (phone && phone !== existingUser.phone) {
      const phoneExists = await Registration.findOne({
        _id: { $ne: id },
        phone: phone,
        isActive: { $ne: false }
      });

      if (phoneExists) {
        return ResponseHelper.error(res, "Phone number already exists for another user", 409);
      }
    }

    // Build update object with only provided fields
    const updateData = { updatedAt: new Date() };

   
    if (name !== name) updateData.name = name;
    if (email !== email) updateData.email = email;
    if (contactNumber !== contactNumber) updateData.contactNumber = contactNumber;
  

    // Update user profile in registration collection
    const updatedUser = await Registration.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    ).select('-password'); // Exclude password from response

    return ResponseHelper.success(res, {
      user: updatedUser,
      updatedFields: Object.keys(updateData).filter(field => field !== 'updatedAt')
    }, "User profile updated successfully", 200);

  } catch (error) {
    console.error('Error updating user profile:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return ResponseHelper.error(res, `Validation failed: ${messages.join(', ')}`, 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return ResponseHelper.error(res, `User with this ${duplicateField} already exists`, 409);
    }

    return ResponseHelper.error(res, "Internal server error while updating user profile", 500);
  }
};

// Update user password (login collection)
exports.updateUserPassword = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "User ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid user ID format", 400);
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return ResponseHelper.error(res, "Current password, new password, and confirm password are required", 400);
    }

    if (newPassword !== confirmPassword) {
      return ResponseHelper.error(res, "New password and confirm password do not match", 400);
    }

    if (newPassword.length < 6) {
      return ResponseHelper.error(res, "New password must be at least 6 characters long", 400);
    }

    // Execute transaction for atomic operations
    const result = await session.withTransaction(async () => {
      // Find user in registration collection
      const user = await Registration.findOne({
        _id: id,
        isActive: { $ne: false }
      }).session(session);

      if (!user) {
        throw new Error('USER_NOT_FOUND');
      }

      // Find corresponding login record
      const loginRecord = await Login.findOne({
        email: user.email
      }).session(session);

      if (!loginRecord) {
        throw new Error('LOGIN_RECORD_NOT_FOUND');
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, loginRecord.password);
      if (!isCurrentPasswordValid) {
        throw new Error('INVALID_CURRENT_PASSWORD');
      }

      // Hash new password
      const saltRounds = 12;
      const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

      // Update password in login collection
      const passwordUpdate = await Login.updateOne(
        { email: user.email },
        { 
          $set: { 
            password: hashedNewPassword,
            updatedAt: new Date()
          }
        }
      ).session(session);

      if (passwordUpdate.modifiedCount === 0) {
        throw new Error('PASSWORD_UPDATE_FAILED');
      }

      return {
        userEmail: user.email,
        passwordUpdated: true
      };
    });

    return ResponseHelper.success(res, {
      userId: id,
      email: result.userEmail,
      passwordUpdated: result.passwordUpdated,
      updatedAt: new Date().toISOString()
    }, "Password updated successfully", 200);

  } catch (error) {
    console.error('Error updating password:', error.message);

    // Handle specific errors
    if (error.message === 'USER_NOT_FOUND') {
      return ResponseHelper.error(res, "User not found or has been deactivated", 404);
    }

    if (error.message === 'LOGIN_RECORD_NOT_FOUND') {
      return ResponseHelper.error(res, "Login record not found for this user", 404);
    }

    if (error.message === 'INVALID_CURRENT_PASSWORD') {
      return ResponseHelper.error(res, "Current password is incorrect", 401);
    }

    if (error.message === 'PASSWORD_UPDATE_FAILED') {
      return ResponseHelper.error(res, "Failed to update password", 500);
    }

    return ResponseHelper.error(res, "Internal server error while updating password", 500);

  } finally {
    await session.endSession();
  }
};

// Update user profile and password together (atomic operation)  commented out for now
// exports.updateUserComplete = async (req, res) => {
//   const session = await mongoose.startSession();

//   try {
//     const { id } = req.params;
//     const {
//       // Profile fields
//       firstName,
//       lastName,
//       email,
//       phone,
//       address,
//       dateOfBirth,
//       profileImage,
//       // Password fields
//       currentPassword,
//       newPassword,
//       confirmPassword
//     } = req.body;

//     // Validation
//     if (!id) {
//       return ResponseHelper.error(res, "User ID is required", 400);
//     }

//     if (!mongoose.Types.ObjectId.isValid(id)) {
//       return ResponseHelper.error(res, "Invalid user ID format", 400);
//     }

//     // If password update is requested, validate password fields
//     const isPasswordUpdate = currentPassword && newPassword && confirmPassword;
//     if (isPasswordUpdate) {
//       if (newPassword !== confirmPassword) {
//         return ResponseHelper.error(res, "New password and confirm password do not match", 400);
//       }

//       if (newPassword.length < 6) {
//         return ResponseHelper.error(res, "New password must be at least 6 characters long", 400);
//       }
//     }

//     // Execute transaction for atomic operations
//     const result = await session.withTransaction(async () => {
//       // Find user in registration collection
//       const user = await Registration.findOne({
//         _id: id,
//         isActive: { $ne: false }
//       }).session(session);

//       if (!user) {
//         throw new Error('USER_NOT_FOUND');
//       }

//       // Check for duplicate email if being updated
//       if (email && email !== user.email) {
//         const emailExists = await Registration.findOne({
//           _id: { $ne: id },
//           email: email,
//           isActive: { $ne: false }
//         }).session(session);

//         if (emailExists) {
//           throw new Error('EMAIL_EXISTS');
//         }
//       }

//       // Check for duplicate phone if being updated
//       if (phone && phone !== user.phone) {
//         const phoneExists = await Registration.findOne({
//           _id: { $ne: id },
//           phone: phone,
//           isActive: { $ne: false }
//         }).session(session);

//         if (phoneExists) {
//           throw new Error('PHONE_EXISTS');
//         }
//       }

//       // Build profile update object
//       const profileUpdateData = { updatedAt: new Date() };
//       if (firstName !== undefined) profileUpdateData.firstName = firstName;
//       if (lastName !== undefined) profileUpdateData.lastName = lastName;
//       if (email !== undefined) profileUpdateData.email = email;
//       if (phone !== undefined) profileUpdateData.phone = phone;
//       if (address !== undefined) profileUpdateData.address = address;
//       if (dateOfBirth !== undefined) profileUpdateData.dateOfBirth = dateOfBirth;
//       if (profileImage !== undefined) profileUpdateData.profileImage = profileImage;

//       // Update profile if there are fields to update
//       let updatedUser = user;
//       if (Object.keys(profileUpdateData).length > 1) { // More than just updatedAt
//         updatedUser = await Registration.findByIdAndUpdate(
//           id,
//           profileUpdateData,
//           {
//             new: true,
//             runValidators: true,
//             session
//           }
//         ).select('-password');
//       }

//       let passwordUpdated = false;
//       // Update password if requested
//       if (isPasswordUpdate) {
//         // Find login record
//         const loginRecord = await Login.findOne({
//           email: user.email
//         }).session(session);

//         if (!loginRecord) {
//           throw new Error('LOGIN_RECORD_NOT_FOUND');
//         }

//         // Verify current password
//         const isCurrentPasswordValid = await bcrypt.compare(currentPassword, loginRecord.password);
//         if (!isCurrentPasswordValid) {
//           throw new Error('INVALID_CURRENT_PASSWORD');
//         }

//         // Hash new password
//         const saltRounds = 12;
//         const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

//         // Update password in login collection
//         await Login.updateOne(
//           { email: user.email },
//           { 
//             $set: { 
//               password: hashedNewPassword,
//               updatedAt: new Date()
//             }
//           }
//         ).session(session);

//         passwordUpdated = true;
//       }

//       return {
//         user: updatedUser,
//         profileUpdated: Object.keys(profileUpdateData).length > 1,
//         passwordUpdated,
//         updatedFields: Object.keys(profileUpdateData).filter(field => field !== 'updatedAt')
//       };
//     });

//     return ResponseHelper.success(res, {
//       user: result.user,
//       profileUpdated: result.profileUpdated,
//       passwordUpdated: result.passwordUpdated,
//       updatedFields: result.updatedFields,
//       updatedAt: new Date().toISOString()
//     }, "User information updated successfully", 200);

//   } catch (error) {
//     console.error('Error updating user information:', error.message);

//     // Handle specific errors
//     if (error.message === 'USER_NOT_FOUND') {
//       return ResponseHelper.error(res, "User not found or has been deactivated", 404);
//     }

//     if (error.message === 'EMAIL_EXISTS') {
//       return ResponseHelper.error(res, "Email already exists for another user", 409);
//     }

//     if (error.message === 'PHONE_EXISTS') {
//       return ResponseHelper.error(res, "Phone number already exists for another user", 409);
//     }

//     if (error.message === 'LOGIN_RECORD_NOT_FOUND') {
//       return ResponseHelper.error(res, "Login record not found for this user", 404);
//     }

//     if (error.message === 'INVALID_CURRENT_PASSWORD') {
//       return ResponseHelper.error(res, "Current password is incorrect", 401);
//     }

//     return ResponseHelper.error(res, "Internal server error while updating user information", 500);

//   } finally {
//     await session.endSession();
//   }
// };

// Get user profile details
exports.getUserProfile = async (req, res) => {
  try {
    const { id } = req.params;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "User ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid user ID format", 400);
    }

    // Find user in registration collection
    const user = await Registration.findOne({
      _id: id,
      isActive: { $ne: false }
    }).select('-password'); // Exclude password from response

    if (!user) {
      return ResponseHelper.error(res, "User not found or has been deactivated", 404);
    }

    return ResponseHelper.success(res, user, "User profile retrieved successfully", 200);

  } catch (error) {
    console.error('Error retrieving user profile:', error);
    return ResponseHelper.error(res, "Internal server error while retrieving user profile", 500);
  }
};

// Update user status (activate/deactivate)
exports.updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "User ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid user ID format", 400);
    }

    if (typeof isActive !== 'boolean') {
      return ResponseHelper.error(res, "isActive must be a boolean value", 400);
    }

    // Check if user exists
    const existingUser = await Registration.findById(id);
    if (!existingUser) {
      return ResponseHelper.error(res, "User not found", 404);
    }

    // Update user status
    const updatedUser = await Registration.findByIdAndUpdate(
      id,
      {
        isActive,
        updatedAt: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    return ResponseHelper.success(res, updatedUser, `User ${isActive ? 'activated' : 'deactivated'} successfully`, 200);

  } catch (error) {
    console.error('Error updating user status:', error);
    return ResponseHelper.error(res, "Internal server error while updating user status", 500);
  }
};