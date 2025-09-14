const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const authMiddleware = require("../middleware/authMiddleware");

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


module.exports = router;
