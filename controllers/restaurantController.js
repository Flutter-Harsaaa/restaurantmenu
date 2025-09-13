const Restaurant = require("../models/Restaurant");
const Login = require("../models/Login");
const ResponseHelper = require("../utils/responseHelper");
const mongoose = require("mongoose");

// Register a new restaurant
exports.registerRestaurant = async (req, res) => {
  // Start a session for transaction
  const session = await mongoose.startSession();
  
  try {
    // Start transaction
    session.startTransaction();
    
    const {
      restaurantName,
      restaurantContactNumber,
      restaurantAddress,
      logoUrl,
      minOrderTime,
      maxOrderTime,
      staffCount,
      cuisine,
      selectedTempId,
      restaurantEmail,
      restaurantGpsAddress
    } = req.body;

    // Validate required fields
    if (!restaurantName || !restaurantContactNumber || !restaurantAddress || 
        !minOrderTime || !maxOrderTime || !cuisine || !selectedTempId) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Missing required fields: restaurantName, restaurantContactNumber, restaurantAddress, minOrderTime, maxOrderTime, cuisine, and selectedTempId are required", 400);
    }

    // Get user email from JWT token (populated by authMiddleware)
    const userEmail = req.user.email;
    if (!userEmail) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Unable to extract user information from token", 401);
    }

    // Check if user exists in Login collection
    const loginUser = await Login.findOne({ email: userEmail }).session(session);
    if (!loginUser) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "User not found in system", 404);
    }

    // Check if user already has a restaurant setup
    if (loginUser.isSetup === 1 && loginUser.resId) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "User already has a restaurant registered", 400);
    }

    // Validate unique contact + address
    const existingRestaurant = await Restaurant.findOne({
      $or: [
        { restaurantContactNumber },
        { restaurantEmail }
      ]
    }).session(session);

    if (existingRestaurant) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Restaurant with this contact number or email already exists", 400);
    }

    // Create new restaurant
    const newRestaurant = new Restaurant({
      restaurantName,
      restaurantContactNumber,
      restaurantAddress,
      logoUrl,
      minOrderTime,
      maxOrderTime,
      staffCount: staffCount || 0,
      cuisine,
      selectedTempId,
      restaurantEmail,
      restaurantGpsAddress,
      isActive: true
    });

    // Save restaurant with session
    await newRestaurant.save({ session });

    // Update login collection - set isSetup to 1 and resId to new restaurant's ID
    const updatedLogin = await Login.findOneAndUpdate(
      { email: userEmail },
      { 
        isSetup: 1,
        resId: newRestaurant._id
      },
      { 
        new: true, 
        session 
      }
    ).select('-password'); // Exclude password from response

    if (!updatedLogin) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Failed to update user setup status", 500);
    }

    // Commit transaction
    await session.commitTransaction();

    // Prepare success response data
    const responseData = {
      restaurant: {
        id: newRestaurant._id,
        restaurantName: newRestaurant.restaurantName,
        restaurantContactNumber: newRestaurant.restaurantContactNumber,
        restaurantAddress: newRestaurant.restaurantAddress,
        logoUrl: newRestaurant.logoUrl,
        minOrderTime: newRestaurant.minOrderTime,
        maxOrderTime: newRestaurant.maxOrderTime,
        staffCount: newRestaurant.staffCount,
        cuisine: newRestaurant.cuisine,
        selectedTempId: newRestaurant.selectedTempId,
        restaurantEmail: newRestaurant.restaurantEmail,
        restaurantGpsAddress: newRestaurant.restaurantGpsAddress,
        isActive: newRestaurant.isActive,
        createdAt: newRestaurant.createdAt,
        updatedAt: newRestaurant.updatedAt
      },
      userStatus: {
        email: updatedLogin.email,
        isSetup: updatedLogin.isSetup,
        resId: updatedLogin.resId,
        isVerified: updatedLogin.isVerified,
        isActive: updatedLogin.isActive
      }
    };

    return ResponseHelper.success(res, responseData, "Restaurant registered successfully and user setup completed", 201);

  } catch (err) {
    // Abort transaction on error
    await session.abortTransaction();
    
    console.error("Restaurant registration error:", err);
    
    // Handle specific MongoDB errors
    if (err.code === 11000) {
      // Handle duplicate key errors
      const duplicateField = Object.keys(err.keyPattern)[0];
      return ResponseHelper.error(res, `A restaurant with this ${duplicateField} already exists`, 400);
    }
    
    if (err.name === 'ValidationError') {
      // Handle mongoose validation errors
      const validationErrors = Object.values(err.errors).map(e => e.message);
      return ResponseHelper.error(res, `Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    return ResponseHelper.error(res, "Internal server error during restaurant registration", 500);
    
  } finally {
    // End session
    session.endSession();
  } 
};

// Get all restaurants
exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find()
      .populate('selectedTempId', 'templateName') // Populate template info if needed
      .sort({ createdAt: -1 }); // Sort by newest first

    const responseData = {
      restaurants,
      count: restaurants.length
    };

    return ResponseHelper.success(res, responseData, "Restaurants retrieved successfully", 200);

  } catch (err) {
    console.error("Get restaurants error:", err);
    return ResponseHelper.error(res, "Internal server error while fetching restaurants", 500);
  }
};
