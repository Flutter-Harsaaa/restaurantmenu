const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Registration = require("../models/Registration");
const Login = require("../models/Login");
const nodemailer = require('nodemailer');
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
