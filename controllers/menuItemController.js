const MenuItem = require('../models/menuItem');
const ResponseHelper = require('../utils/responseHelper');

exports.createMenuItem = async (req, res) => {
  try {
    const { itemName, description, price, discountPrice, quantity, itemCategory, prepTime, calories, spicyLevel, rating, ingredients, image } = req.body;
    const { resId } = req.params;

    if (!itemName) {
      return ResponseHelper.error(res, "Item name is required", 400, ['ITEM_NAME_REQUIRED']);
    }
    if (!price && price !== 0) {
      return ResponseHelper.error(res, "Price is required", 400, ['PRICE_REQUIRED']);
    }
    if (!itemCategory) {
      return ResponseHelper.error(res, "Item category is required", 400, ['ITEM_CATEGORY_REQUIRED']);
    }
    if (!["veg", "non-veg", "pig"].includes(itemCategory)) {
      return ResponseHelper.error(res, "Invalid item category", 400, ['INVALID_ITEM_CATEGORY']);
    }
    if (spicyLevel && !["low", "medium", "high"].includes(spicyLevel)) {
      return ResponseHelper.error(res, "Invalid spicy level", 400, ['INVALID_SPICY_LEVEL']);
    }

    const newMenuItem = await MenuItem.create({
      itemName,
      description,
      price,
      discountPrice,
      quantity,
      itemCategory,
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
    const items = await MenuItem.find({ resId });
    return ResponseHelper.success(res, items, "Items fetched successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};

exports.getMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const item = await MenuItem.findOne({ _id: itemId, resId });

    if (!item) {
      return ResponseHelper.error(res, "Menu item not found", 404, ['ITEM_NOT_FOUND']);
    }

    return ResponseHelper.success(res, item, "Item fetched successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};

exports.updateMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const updateData = req.body;

    // If updating category or spicyLevel, validate enums
    if (updateData.itemCategory && !["veg", "non-veg", "pig"].includes(updateData.itemCategory)) {
      return ResponseHelper.error(res, "Invalid item category", 400, ['INVALID_ITEM_CATEGORY']);
    }
    if (updateData.spicyLevel && !["low", "medium", "high"].includes(updateData.spicyLevel)) {
      return ResponseHelper.error(res, "Invalid spicy level", 400, ['INVALID_SPICY_LEVEL']);
    }

    const updatedItem = await MenuItem.findOneAndUpdate(
      { _id: itemId, resId },
      { $set: updateData },
      { new: true }
    );

    if (!updatedItem) {
      return ResponseHelper.error(res, "Menu item not found", 404, ['ITEM_NOT_FOUND']);
    }

    return ResponseHelper.success(res, updatedItem, "Item updated successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};

exports.deleteMenuItem = async (req, res) => {
  try {
    const { resId, itemId } = req.params;
    const deletedItem = await MenuItem.findOneAndDelete({ _id: itemId, resId });

    if (!deletedItem) {
      return ResponseHelper.error(res, "Menu item not found", 404, ['ITEM_NOT_FOUND']);
    }

    return ResponseHelper.success(res, deletedItem, "Item deleted successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal Server Error", 500, [error.message]);
  }
};
