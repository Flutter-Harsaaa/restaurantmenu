const Restaurant = require("../models/Restaurant");
const Login = require("../models/Login");
const ResponseHelper = require("../utils/responseHelper");
const mongoose = require("mongoose");
const { uploadImage, deleteImage } = require('../utils/cloudinaryHelper');


exports.registerRestaurant = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const {
      restaurantName,
      restaurantContactNumber,
      restaurantAddress,
      minOrderTime,
      maxOrderTime,
      staffCount,
      cuisine,
      selectedTempId,
      restaurantEmail,
      restaurantGpsAddress
    } = req.body;

    if (!restaurantName || !restaurantContactNumber || !restaurantAddress || !minOrderTime || !maxOrderTime || !cuisine || !selectedTempId) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Missing required fields: restaurantName, restaurantContactNumber, restaurantAddress, minOrderTime, maxOrderTime, cuisine, and selectedTempId are required", 400);
    }

    const userEmail = req.user.email;
    if (!userEmail) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Unable to extract user information from token", 401);
    }

    const loginUser = await Login.findOne({ email: userEmail }).session(session);
    if (!loginUser) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "User not found in system", 404);
    }

    if (loginUser.isSetup === 1 && loginUser.resId) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "User already has a restaurant registered", 400);
    }

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

    // Upload logo if provided (assumes multer memoryStorage middleware used)
    let logoUrl = null;
    if (req.file && req.file.buffer) {
      logoUrl = await uploadImage({
        filePath: req.file.buffer,
        restaurantName,
        type: "restaurantLogo"
      });
    }

    const newRestaurant = new Restaurant({
      restaurantName,
      restaurantContactNumber,
      restaurantAddress,
      minOrderTime,
      maxOrderTime,
      staffCount: staffCount || 0,
      cuisine,
      selectedTempId,
      restaurantEmail,
      restaurantGpsAddress,
      logoUrl,
      isActive: true
    });

    await newRestaurant.save({ session });

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
    ).select('-password');

    if (!updatedLogin) {
      await session.abortTransaction();
      return ResponseHelper.error(res, "Failed to update user setup status", 500);
    }

    await session.commitTransaction();

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
    await session.abortTransaction();

    console.error("Restaurant registration error:", err);

    if (err.code === 11000) {
      const duplicateField = Object.keys(err.keyPattern)[0];
      return ResponseHelper.error(res, `A restaurant with this ${duplicateField} already exists`, 400);
    }

    if (err.name === 'ValidationError') {
      const validationErrors = Object.values(err.errors).map(e => e.message);
      return ResponseHelper.error(res, `Validation failed: ${validationErrors.join(', ')}`, 400);
    }

    return ResponseHelper.error(res, "Internal server error during restaurant registration", 500);

  } finally {
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

exports.deleteRestaurant = async (req, res) => {
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

exports.updateRestaurant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return ResponseHelper.error(res, "Invalid restaurant ID format", 400);
    }

    const restaurant = await Restaurant.findById(id);
    if (!restaurant) {
      return ResponseHelper.error(res, "Restaurant not found", 404);
    }

    // Prepare update object from req.body fields, excluding logoUrl
    const updateData = { ...req.body };
    delete updateData.logoUrl; // Prevent direct manual override

    // If image file is provided, update logo
    if (req.file && req.file.buffer) {
      // Delete old logo from Cloudinary if exists
      if (restaurant.logoUrl) {
        await deleteImage(restaurant.restaurantName, "restaurantLogo");
      }

      // Upload new logo
      const newLogoUrl = await uploadImage({
        filePath: req.file.buffer,
        restaurantName: restaurant.restaurantName,
        type: "restaurantLogo"
      });

      updateData.logoUrl = newLogoUrl;
    }

    updateData.updatedAt = new Date();

    // Apply updates
    const updatedRestaurant = await Restaurant.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return ResponseHelper.success(res, updatedRestaurant, "Restaurant updated successfully", 200);

  } catch (error) {
    console.error("Update restaurant error:", error);
    return ResponseHelper.error(res, "Internal server error while updating restaurant", 500);
  }
};


