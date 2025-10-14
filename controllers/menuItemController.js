const MenuItem = require('../models/MenuItem.js');
const ResponseHelper = require('../utils/responseHelper');

const Category = require('../models/Category'); // Import your Category model

exports.createMenuItem = async (req, res) => {
  try {
    const { itemName, description, price, discountPrice, quantity, tags, itemCategory, productCategory, prepTime, calories, spicyLevel, rating, ingredients, image } = req.body;
    const { resId } = req.params;

    // basic validations
    if (!itemName) return ResponseHelper.error(res, "Item name is required", 400);
    if (!price && price !== 0) return ResponseHelper.error(res, "Price is required", 400);
    if (!itemCategory) return ResponseHelper.error(res, "Item category is required", 400);
    if (!["veg", "non-veg"].includes(itemCategory)) return ResponseHelper.error(res, "Invalid item category", 400);
    if (spicyLevel && !["low", "medium", "high"].includes(spicyLevel)) return ResponseHelper.error(res, "Invalid spicy level", 400);

    // 🔍 Validate productCategory existence
    const categoryExists = await Category.findById(productCategory);
    if (!categoryExists) {
      return ResponseHelper.error(res, "Product category not available", 404);
    }

    // create menu item
    const newMenuItem = await MenuItem.create({
      itemName,
      description,
      price,
      discountPrice,
      quantity,
      tags,
      itemCategory,
      productCategory,
      prepTime,
      calories,
      spicyLevel,
      rating,
      ingredients,
      image,
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
    const updateData = req.body;

    // Validate enums if provided
    if (updateData.itemCategory && !["veg", "non-veg"].includes(updateData.itemCategory)) {
      return ResponseHelper.error(res, "Invalid item category", 400);
    }
    if (updateData.spicyLevel && !["low", "medium", "high"].includes(updateData.spicyLevel)) {
      return ResponseHelper.error(res, "Invalid spicy level", 400);
    }

    // 🔍 Validate productCategory if included in update
    if (updateData.productCategory) {
      const categoryExists = await Category.findById(updateData.productCategory);
      if (!categoryExists) {
        return ResponseHelper.error(res, "Product category not available", 404);
      }
    }

    // Update the item
    const updatedItem = await MenuItem.findOneAndUpdate(
      { _id: itemId, resId },
      { $set: updateData },
      { new: true, runValidators: true } // ensures schema validators run
    );

    if (!updatedItem) {
      return ResponseHelper.error(res, "Menu item not found", 404);
    }

    return ResponseHelper.success(res, updatedItem, "Item updated successfully", 200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};


exports.deleteMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const deletedItem = await MenuItem.findOneAndDelete({ _id: itemId, resId });

    if (!deletedItem) {
      return ResponseHelper.error(res, "Menu item not found", 404);
    }

    return ResponseHelper.success(res, deletedItem, "Item deleted successfully",200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};
