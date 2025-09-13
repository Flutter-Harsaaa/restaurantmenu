// middleware/auth.js
const jwt = require("jsonwebtoken");
const ResponseHelper = require("../utils/responseHelper");

const authenticateToken = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return ResponseHelper.error(res, "Access token is missing. Please provide a valid authorization header", 401);
    }

    if (!authHeader.startsWith('Bearer ')) {
      return ResponseHelper.error(res, "Invalid token format. Token must be in format 'Bearer <token>'", 401);
    }

    const token = authHeader.slice(7); // Remove 'Bearer ' prefix

    if (!token) {
      return ResponseHelper.error(res, "Access token is missing. Please provide a valid token", 401);
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        // Handle different JWT errors
        if (err.name === 'TokenExpiredError') {
          return ResponseHelper.error(res, "Token has expired. Please login again to get a new token", 401);
        }
        
        if (err.name === 'JsonWebTokenError') {
          return ResponseHelper.error(res, "Invalid token. Please provide a valid authentication token", 401);
        }
        
        if (err.name === 'NotBeforeError') {
          return ResponseHelper.error(res, "Token is not active yet. Please try again later", 401);
        }
        
        // Generic error for any other JWT-related issues
        return ResponseHelper.error(res, "Token verification failed. Please login again", 401);
      }

      // Token is valid, attach user info to request
      req.user = decoded;
      next();
    });

  } catch (error) {
    return ResponseHelper.error(res, "Internal server error during token verification", 500);
  }
};

module.exports = authenticateToken;
