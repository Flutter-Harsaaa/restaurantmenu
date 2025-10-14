const MenuItem = require('../models/MenuItem.js');
const ResponseHelper = require('../utils/responseHelper');
const Category = require('../models/Category'); // Import your Category model
const { uploadImage } = require('../utils/cloudinaryHelper');
const Restaurant = require('../models/Restaurant.js');

exports.createMenuItem = async (req, res) => {
  try {
    const {
      itemName, description, price, discountPrice, quantity, tags,
      itemCategory, productCategory, prepTime, calories,
      spicyLevel, rating, ingredients
    } = req.body;
    const { resId } = req.params;

    // Validations (as before)
    if (!itemName) return ResponseHelper.error(res, "Item name is required", 400);
    if (!price && price !== 0) return ResponseHelper.error(res, "Price is required", 400);
    if (!itemCategory) return ResponseHelper.error(res, "Item category is required", 400);
    if (!["veg", "non-veg"].includes(itemCategory)) return ResponseHelper.error(res, "Invalid item category", 400);
    if (spicyLevel && !["low", "medium", "high"].includes(spicyLevel)) return ResponseHelper.error(res, "Invalid spicy level", 400);

    const categoryExists = await Category.findById(productCategory);
    if (!categoryExists) return ResponseHelper.error(res, "Product category not available", 404);
    const  restaurantExist=await Restaurant.findById(resId);
    if (!restaurantExist) return ResponseHelper.error(res, "Restaurant not available", 404);


    let imageUrls = [];

    if (req.files && req.files.length) {
      for (let i = 0; i < req.files.length; i++) {
        const url = await uploadImage({
          filePath: req.files[i].buffer,
          restaurantName: restaurantExist.restaurantName ? restaurantExist.restaurantName.toString() : '',/* pass actual restaurant name if available */
          type: "menuitem",
          menuItemName: itemName,
          imageIndex: i + 1,
        });
        imageUrls.push(url);
      }
    } else if (req.body.image) {
      if (Array.isArray(req.body.image)) {
        imageUrls = req.body.image;
      } else {
        imageUrls = [req.body.image];
      }
    }

    const newMenuItem = await MenuItem.create({
      itemName, description, price, discountPrice, quantity, tags,
      itemCategory, productCategory, prepTime, calories,
      spicyLevel, rating, ingredients,isActive:1,
      image: imageUrls,
      resId
    });

    return ResponseHelper.success(res, newMenuItem, "Item created successfully", 201);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};




exports.getMenuItems = async (req, res) => {
  try {
    const { resId } = req.params;
    const {
      search = '',
      minPrice,
      maxPrice,
      tags,
      sortBy = 'createdAt',
      order = 'desc',
      page = 1,
      limit = 10
    } = req.query;

    // Build the query object
    let query = { resId };

    // Search by itemName (case-insensitive, partial match)
    if (search) {
      query.itemName = { $regex: search, $options: 'i' };
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice !== undefined) query.price.$gte = Number(minPrice);
      if (maxPrice !== undefined) query.price.$lte = Number(maxPrice);
    }

    // Tags filter
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(',');
      query.tags = { $in: tagArray };
    }

    // Sort
    let sortOption = {};
    sortOption[sortBy] = order === 'asc' ? 1 : -1;

    // Pagination
    const skip = (Number(page) - 1) * Number(limit);

    // Fetch items with filters and options
    const items = await MenuItem.find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(Number(limit));

    // For total count (useful for pagination on frontend)
    const total = await MenuItem.countDocuments(query);

    return ResponseHelper.success(res, { items, total }, "Items fetched successfully", 200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};


exports.getMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const item = await MenuItem.findOne({ _id: itemId, resId });

    if (!item) {
      return ResponseHelper.error(res, "Menu item not found", 404);
    }

    return ResponseHelper.success(res, item, "Item fetched successfully",200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const updateData = { ...req.body };

    // Validate enums and productCategory as usual
    if (updateData.itemCategory && !["veg", "non-veg"].includes(updateData.itemCategory))
      return ResponseHelper.error(res, "Invalid item category", 400);
    if (updateData.spicyLevel && !["low", "medium", "high"].includes(updateData.spicyLevel))
      return ResponseHelper.error(res, "Invalid spicy level", 400);

    if (updateData.productCategory) {
      const categoryExists = await Category.findById(updateData.productCategory);
      if (!categoryExists) return ResponseHelper.error(res, "Product category not available", 404);
    }

    if (resId) {
    const  restaurantExist=await Restaurant.findById(resId);
    if (!restaurantExist) return ResponseHelper.error(res, "Restaurant not available", 404);
    }
    // Handle new images upload
    if (req.files && req.files.length) {
      const newImageUrls = [];
      for (let i = 0; i < req.files.length; i++) {
        const url = await uploadImage({
          filePath: req.files[i].buffer,
          restaurantName:restaurantExist.restaurantName ? restaurantExist.restaurantName.toString() : '', /* pass your restaurant name as needed */
          type: "menuitem",
          menuItemName: updateData.itemName || '',
          imageIndex: i + 1
        });
        newImageUrls.push(url);
      }

      // Append new images to current list
      if (updateData.image && Array.isArray(updateData.image)) {
        updateData.image = [...updateData.image, ...newImageUrls];
      } else {
        updateData.image = newImageUrls;
      }
    }

    const updatedItem = await MenuItem.findOneAndUpdate(
      { _id: itemId, resId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedItem) return ResponseHelper.error(res, "Menu item not found", 404);

    return ResponseHelper.success(res, updatedItem, "Item updated successfully", 200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};




exports.deleteMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const result = await MenuItem.findOneAndUpdate(
      { _id: itemId, resId },
      { $set: { isActive: 0 } }, // or 0, depending on your schema
      { new: true }
    );

    if (!result) return ResponseHelper.error(res, "Menu item not found", 404);

    return ResponseHelper.success(res, result, "Menu item soft deleted successfully", 200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500);
  }
};

