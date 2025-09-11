const Restaurant = require("../models/Restaurant");

// Register a new restaurant
exports.registerRestaurant = async (req, res) => {
  try {
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

    // Validate unique contact + address
    const existingRestaurant = await Restaurant.findOne({
      $or: [
        { restaurantContactNumber },
        { restaurantEmail } //changed by me.
      ]
    });

    if (existingRestaurant) {
      return res.status(400).json({
        error: "Restaurant with this contact number or email already exists"
      });
    }

    const newRestaurant = new Restaurant({
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
      restaurantGpsAddress,
      isActive: true
    });

    await newRestaurant.save();
    console.log("newRestaurant>>>>>>",newRestaurant)
    res.status(201).json({ message: "Restaurant registered successfully", restaurant: newRestaurant });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

// Get all restaurants
exports.getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find();
    res.json(restaurants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};
