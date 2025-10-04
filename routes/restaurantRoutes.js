const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const authMiddleware = require("../middleware/authMiddleware");
const {
  createCategory,
  getCategories,
  updateCategory,
  deleteCategory
} =require("../controllers/categoryController.js");
const {
  createMenuItem,
  getMenuItems,
  getMenuItem,
  updateMenuItem,
  deleteMenuItem
} = require('../controllers/menuItemController');



//restaurants Api's 
// Register new restaurant (POST)
router.post(
  "/register",
  authMiddleware,
  restaurantController.registerRestaurant
);

// Get all restaurants (GET) - optional
router.get(
  "/all-restaurant/",
  authMiddleware,
  restaurantController.getAllRestaurants
);
router.delete('/delete/:id',authMiddleware, restaurantController.deleteRestaurant);
// GET /api/restaurants/id/:id
router.get('/id/:id',authMiddleware, restaurantController.getRestaurantById);

//categories Api's
router.post('/category/create-category/:restaurantId/categories',authMiddleware, createCategory);
router.get('/category/get-category/:restaurantId/categories',authMiddleware, getCategories);
router.put('/category/update-category/:restaurantId/categories/:categoryId',authMiddleware, updateCategory);
router.delete('/category/delete-category/:restaurantId/categories/:categoryId',authMiddleware, deleteCategory);

router.post('/menu/create-menu/:resId/items', createMenuItem);
router.get('/menu/get-all-menu/:resId/items', getMenuItems);
router.get('/menu/get-menu/:resId/items/:itemId', getMenuItem);
router.put('/menu/create-menu/:resId/items/:itemId', updateMenuItem);
router.delete('/menu/create-menu/:resId/items/:itemId', deleteMenuItem);

module.exports = router;
