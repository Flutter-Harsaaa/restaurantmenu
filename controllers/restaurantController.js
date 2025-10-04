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

// Get restaurant by ID
exports.getRestaurantById = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate if ID is provided
    if (!id) {
      return ResponseHelper.error(res, "Restaurant ID is required", 400);
    }

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    const restaurant = await Restaurant.findById(id)
      .populate('selectedTempId'); // Remove the field selection to get all template data

    // Check if restaurant exists
    if (!restaurant) {
      return ResponseHelper.error(res, "Restaurant not found", 404);
    }

    return ResponseHelper.success(res, restaurant, "Restaurant retrieved successfully", 200);

  } catch (err) {
    console.error("Get restaurant by ID error:", err);
    return ResponseHelper.error(res, "Internal server error while fetching restaurant", 500);
  }
};

exports.deleteRestaurant = async (req, res,) => {
  const session = await mongoose.startSession();
  
  try {
    const { id } = req.params;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "Restaurant ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    // Execute transaction
    const result = await session.withTransaction(async () => {
      // Check if restaurant exists and is active
      const restaurant = await Restaurant.findOne({
        _id: id,
        isActive: { $ne: false }
      }).session(session);

      if (!restaurant) {
        throw new Error('RESTAURANT_NOT_FOUND');
      }

      // Set isActive = false in Restaurant collection
      const restaurantUpdate = await Restaurant.updateOne(
        { _id: id },
        { 
          $set: { 
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date()
          }
        }
      ).session(session);

      // Set isSetup = 0 in Login collection using resId field
      const loginupdate=await Login.findOne({ resId: id }).session(session);{
        console.log(loginupdate);
      }
      const loginUpdate = await Login.updateMany(
        { resId: id }, // ✅ Correct field name
        { 
          $set: { 
            isSetup: 0,
            updatedAt: new Date()
          }
        }
      ).session(session);

      return {
        restaurantName: restaurantUpdate.restaurantName,
        loginRecordsModified: loginUpdate.modifiedCount
      };
    });

    // Success response
    return ResponseHelper.success(res, {
      restaurantId: id,
      restaurantName: result.restaurantName,
      deletedAt: new Date().toISOString(),
      loginRecordsUpdated: result.loginRecordsModified
    }, "Restaurant successfully deleted (soft delete)", 200);

  } catch (error) {
    console.error('Error deleting restaurant:', error.message);

    // Handle specific errors
    if (error.message === 'RESTAURANT_NOT_FOUND') {
      return ResponseHelper.error(res, "Restaurant not found or already deleted", 404);
    }

    return ResponseHelper.error(res, "Internal server error while deleting restaurant", 500);

  } finally {
    // Always cleanup session
    await session.endSession();
  }
};





// Update restaurant data (PUT - Full Update)
exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "Restaurant ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    // Check if restaurant exists and is active
    const existingRestaurant = await Restaurant.findOne({
      _id: id,
      isActive: { $ne: false }
    });

    if (!existingRestaurant) {
      return ResponseHelper.error(res, "Restaurant not found or has been deleted", 404);
    }

    // Extract updatable fields from request body
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

    // Validate required fields for full update
    if (!restaurantName || !restaurantContactNumber || !restaurantAddress || 
        !minOrderTime || !maxOrderTime || !cuisine) {
      return ResponseHelper.error(res, "Missing required fields: restaurantName, restaurantContactNumber, restaurantAddress, minOrderTime, maxOrderTime, and cuisine are required for full update", 400);
    }

    // Check for duplicate contact number or email (excluding current restaurant)
    const duplicateCheck = await Restaurant.findOne({
      _id: { $ne: id },
      isActive: { $ne: false },
      $or: [
        { restaurantContactNumber },
        ...(restaurantEmail ? [{ restaurantEmail }] : [])
      ]
    });

    if (duplicateCheck) {
      return ResponseHelper.error(res, "Another restaurant with this contact number or email already exists", 409);
    }

    // Update restaurant with new data
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
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
        updatedAt: new Date()
      },
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validations
        context: 'query' // For custom validators
      }
    ).populate('selectedTempId', 'templateName');

    return ResponseHelper.success(res, updatedRestaurant, "Restaurant updated successfully", 200);

  } catch (error) {
    console.error('Error updating restaurant:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return ResponseHelper.error(res, `Validation failed: ${messages.join(', ')}`, 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return ResponseHelper.error(res, `A restaurant with this ${duplicateField} already exists`, 409);
    }

    return ResponseHelper.error(res, "Internal server error while updating restaurant", 500);
  }
};

// Partial update restaurant data (PATCH - Partial Update)
exports.updateRestaurantPartial = async (req, res) => {
  try {
    const { id } = req.params;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "Restaurant ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    // Check if restaurant exists and is active
    const existingRestaurant = await Restaurant.findOne({
      _id: id,
      isActive: { $ne: false }
    });

    if (!existingRestaurant) {
      return ResponseHelper.error(res, "Restaurant not found or has been deleted", 404);
    }

    // Get only the fields that are provided in request body
    const updateFields = {};
    const allowedFields = [
      'restaurantName', 'restaurantContactNumber', 'restaurantAddress',
      'logoUrl', 'minOrderTime', 'maxOrderTime', 'staffCount',
      'cuisine', 'selectedTempId', 'restaurantEmail', 'restaurantGpsAddress'
    ];

    // Only include fields that are actually provided
    allowedFields.forEach(field => {
      if (req.body.hasOwnProperty(field)) {
        updateFields[field] = req.body[field];
      }
    });

    // Always update the updatedAt timestamp
    updateFields.updatedAt = new Date();

    // Check if any fields to update
    if (Object.keys(updateFields).length === 1) { // Only updatedAt
      return ResponseHelper.error(res, "No fields provided for update", 400);
    }

    // Check for duplicates if contact or email is being updated
    if (updateFields.restaurantContactNumber || updateFields.restaurantEmail) {
      const duplicateQuery = {
        _id: { $ne: id },
        isActive: { $ne: false },
        $or: []
      };

      if (updateFields.restaurantContactNumber) {
        duplicateQuery.$or.push({ restaurantContactNumber: updateFields.restaurantContactNumber });
      }
      if (updateFields.restaurantEmail) {
        duplicateQuery.$or.push({ restaurantEmail: updateFields.restaurantEmail });
      }

      const duplicateCheck = await Restaurant.findOne(duplicateQuery);
      if (duplicateCheck) {
        return ResponseHelper.error(res, "Another restaurant with this contact number or email already exists", 409);
      }
    }

    // Update restaurant with partial data
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      updateFields,
      {
        new: true, // Return updated document
        runValidators: true, // Run schema validations
        context: 'query' // For custom validators
      }
    ).populate('selectedTempId', 'templateName');

    return ResponseHelper.success(res, {
      restaurant: updatedRestaurant,
      updatedFields: Object.keys(updateFields).filter(field => field !== 'updatedAt')
    }, "Restaurant updated successfully", 200);

  } catch (error) {
    console.error('Error partially updating restaurant:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return ResponseHelper.error(res, `Validation failed: ${messages.join(', ')}`, 400);
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern)[0];
      return ResponseHelper.error(res, `A restaurant with this ${duplicateField} already exists`, 409);
    }

    return ResponseHelper.error(res, "Internal server error while updating restaurant", 500);
  }
};

// Update specific restaurant field (specialized endpoints)
exports.updateRestaurantStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "Restaurant ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    if (typeof isActive !== 'boolean') {
      return ResponseHelper.error(res, "isActive must be a boolean value", 400);
    }

    // Check if restaurant exists
    const existingRestaurant = await Restaurant.findById(id);
    if (!existingRestaurant) {
      return ResponseHelper.error(res, "Restaurant not found", 404);
    }

    // Update only the isActive status
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      {
        isActive,
        updatedAt: new Date()
      },
      {
        new: true,
        runValidators: true
      }
    );

    return ResponseHelper.success(res, updatedRestaurant, `Restaurant ${isActive ? 'activated' : 'deactivated'} successfully`, 200);

  } catch (error) {
    console.error('Error updating restaurant status:', error);
    return ResponseHelper.error(res, "Internal server error while updating restaurant status", 500);
  }
};

// Update restaurant contact information only
exports.updateRestaurantContact = async (req, res) => {
  try {
    const { id } = req.params;
    const { restaurantContactNumber, restaurantEmail } = req.body;

    // Validation
    if (!id) {
      return ResponseHelper.error(res, "Restaurant ID is required", 400);
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    if (!restaurantContactNumber && !restaurantEmail) {
      return ResponseHelper.error(res, "Either contact number or email must be provided", 400);
    }

    // Check if restaurant exists and is active
    const existingRestaurant = await Restaurant.findOne({
      _id: id,
      isActive: { $ne: false }
    });

    if (!existingRestaurant) {
      return ResponseHelper.error(res, "Restaurant not found or has been deleted", 404);
    }

    // Build update object
    const updateData = { updatedAt: new Date() };
    if (restaurantContactNumber) updateData.restaurantContactNumber = restaurantContactNumber;
    if (restaurantEmail) updateData.restaurantEmail = restaurantEmail;

    // Check for duplicates
    const duplicateCheck = await Restaurant.findOne({
      _id: { $ne: id },
      isActive: { $ne: false },
      $or: [
        ...(restaurantContactNumber ? [{ restaurantContactNumber }] : []),
        ...(restaurantEmail ? [{ restaurantEmail }] : [])
      ]
    });

    if (duplicateCheck) {
      return ResponseHelper.error(res, "Another restaurant with this contact information already exists", 409);
    }

    // Update contact information
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
        runValidators: true
      }
    );

    return ResponseHelper.success(res, updatedRestaurant, "Restaurant contact information updated successfully", 200);

  } catch (error) {
    console.error('Error updating restaurant contact:', error);

    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return ResponseHelper.error(res, `Validation failed: ${messages.join(', ')}`, 400);
    }

    return ResponseHelper.error(res, "Internal server error while updating restaurant contact", 500);
  }
};

