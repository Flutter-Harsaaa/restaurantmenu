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
router.put('/update/:id',authMiddleware, restaurantController.updateRestaurant);
//some routes are reamining 
// GET /api/restaurants/id/:id
router.get('/id/:id',authMiddleware, restaurantController.getRestaurantById);

//categories Api's
router.post('/create-category/:restaurantId/categories', createCategory);
router.get('/get-category/:restaurantId/categories', getCategories);
router.put('/update-category/:restaurantId/categories/:categoryId', updateCategory);
router.delete('/delete-category/:restaurantId/categories/:categoryId', deleteCategory);
module.exports = router;
