const Category = require("../models/Category");
const ResponseHelper = require("../utils/responseHelper");

exports.createCategory = async (req, res) => {
  try {
    const { name, isActive } = req.body;
    const { restaurantId } = req.params;

    if (!name) {
      return ResponseHelper.error(res, "Category name is required", 400, ['CATEGORY_NAME_REQUIRED']);
    }

    const category = await Category.create({
      name,
      restaurantId,
      isActive: isActive === 0 || isActive === 1 ? isActive : 1,
      isDefault: 0
    });

    return ResponseHelper.success(res, category, "Category created successfully", 201);
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

exports.getCategories = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const categories = await Category.find({
      $or: [
        { restaurantId: restaurantId, isActive: 1 },
        { isDefault: 1, isActive: 1 }
      ]
    });
    return ResponseHelper.success(res, categories, "Categories fetched successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;
    const updateFields = {};
    if (req.body.name) updateFields.name = req.body.name;
    if ([0, 1].includes(req.body.isActive)) updateFields.isActive = req.body.isActive;
    if ([0, 1].includes(req.body.isDefault)) updateFields.isDefault = req.body.isDefault;

    const category = await Category.findOneAndUpdate(
      { _id: categoryId, restaurantId },
      { $set: updateFields },
      { new: true }
    );
    if (!category) {
      return ResponseHelper.error(res, "Category not found for this restaurant", 404, ['CATEGORY_NOT_FOUND']);
    }
    return ResponseHelper.success(res, category, "Category updated successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const { restaurantId, categoryId } = req.params;
    const category = await Category.findOneAndUpdate(
      { _id: categoryId, restaurantId, isActive: 1 },
      { isActive: 0 },
      { new: true }
    );
    if (!category) {
      return ResponseHelper.error(res, "Category not found or already deleted", 404, ['CATEGORY_NOT_FOUND']);
    }
    return ResponseHelper.success(res, category, "Category deleted successfully");
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};
