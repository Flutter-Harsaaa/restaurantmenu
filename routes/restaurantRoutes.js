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
  "/",
  authMiddleware,
  restaurantController.getAllRestaurants
);

module.exports = router;
