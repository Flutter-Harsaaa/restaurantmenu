const Table = require("../models/Table");
const ResponseHelper = require("../utils/responseHelper");

// 1. Create Table
exports.createTable = async (req, res) => {
  try {
    const { tableNumber, capacity, status, location, reservedStatus, isActive } = req.body;
    const { restaurantId } = req.params;

    // Validation
    if (!tableNumber) {
      return ResponseHelper.error(res, "Table number is required", 400);
    }
    if (!capacity) {
      return ResponseHelper.error(res, "Capacity is required", 400);
    }
    if (!location) {
      return ResponseHelper.error(res, "Location is required", 400);
    }

    // Check if table number already exists for this restaurant
    const existingTable = await Table.findOne({ 
      tableNumber, 
      restaurantId, 
      isActive: 1 
    });

    if (existingTable) {
      return ResponseHelper.error(res, "Table number already exists for this restaurant", 400);
    }

    const table = await Table.create({
      tableNumber,
      capacity,
      status: status || 'available',
      location,
      reservedStatus: reservedStatus || false,
      isActive: isActive === 0 || isActive === 1 ? isActive : 1,
      restaurantId
    });

    return ResponseHelper.success(res, table, "Table created successfully", 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return ResponseHelper.error(res, "Validation Error", 400, errors);
    }

    if (error.code === 11000) {
      return ResponseHelper.error(res, "Table number already exists for this restaurant", 400);
    }

    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

// 2. Get All Tables
exports.getAllTables = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { status, location, capacity, page = 1, limit = 10 } = req.query;
    
    // Build filter object
    const filter = { restaurantId, isActive: 1 };
    
    if (status) filter.status = status;
    if (location) filter.location = { $regex: location, $options: 'i' };
    if (capacity) filter.capacity = parseInt(capacity);

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const tables = await Table.find(filter)
      .sort({ tableNumber: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const total = await Table.countDocuments(filter);
    
    const responseData = {
      tables,
      pagination: {
        current: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    };

    return ResponseHelper.success(res, responseData, "Tables fetched successfully",200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

// 3. Get Table By ID
exports.getTableById = async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;

    if (!tableId.match(/^[0-9a-fA-F]{24}$/)) {
      return ResponseHelper.error(res, "Invalid table ID format", 400);
    }

    const table = await Table.findOne({ 
      _id: tableId, 
      restaurantId, 
      isActive: 1 
    });

    if (!table) {
      return ResponseHelper.error(res, "Table not found for this restaurant", 404);
    }

    return ResponseHelper.success(res, table, "Table fetched successfully",200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

// 4. Update Table
exports.updateTable = async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;
    
    if (!tableId.match(/^[0-9a-fA-F]{24}$/)) {
      return ResponseHelper.error(res, "Invalid table ID format", 400);
    }

    // Build update fields object (following your pattern)
    const updateFields = {};
    if (req.body.tableNumber) updateFields.tableNumber = req.body.tableNumber;
    if (req.body.capacity) updateFields.capacity = req.body.capacity;
    if (req.body.status) updateFields.status = req.body.status;
    if (req.body.location) updateFields.location = req.body.location;
    if (req.body.reservedStatus !== undefined) updateFields.reservedStatus = req.body.reservedStatus;
    if ([0, 1].includes(req.body.isActive)) updateFields.isActive = req.body.isActive;

    // Check for duplicate table number
    if (updateFields.tableNumber) {
      const existingTable = await Table.findOne({ 
        tableNumber: updateFields.tableNumber, 
        restaurantId,
        _id: { $ne: tableId },
        isActive: 1 
      });
      
      if (existingTable) {
        return ResponseHelper.error(res, "Table number already exists for this restaurant", 400);
      }
    }

    const table = await Table.findOneAndUpdate(
      { _id: tableId, restaurantId, isActive: 1 },
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!table) {
      return ResponseHelper.error(res, "Table not found for this restaurant", 404);
    }

    return ResponseHelper.success(res, table, "Table updated successfully",200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return ResponseHelper.error(res, "Validation Error", 400, errors);
    }

    if (error.code === 11000) {
      return ResponseHelper.error(res, "Table number already exists for this restaurant", 400);
    }

    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

// 5. Delete Table (Soft Delete)
exports.deleteTable = async (req, res) => {
  try {
    const { restaurantId, tableId } = req.params;

    if (!tableId.match(/^[0-9a-fA-F]{24}$/)) {
      return ResponseHelper.error(res, "Invalid table ID format", 400);
    }

    const table = await Table.findOneAndUpdate(
      { _id: tableId, restaurantId, isActive: 1 },
      { isActive: 0 },
      { new: true }
    );

    if (!table) {
      return ResponseHelper.error(res, "Table not found or already deleted", 404);
    }

    return ResponseHelper.success(res, table, "Table deleted successfully",200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};

// 6. Get Table Statistics
exports.getTableStats = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const stats = await Table.aggregate([
      { $match: { restaurantId: mongoose.Types.ObjectId(restaurantId), isActive: 1 } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalCapacity: { $sum: '$capacity' }
        }
      }
    ]);

    const totalTables = await Table.countDocuments({ restaurantId, isActive: 1 });
    const totalCapacity = await Table.aggregate([
      { $match: { restaurantId: mongoose.Types.ObjectId(restaurantId), isActive: 1 } },
      { $group: { _id: null, total: { $sum: '$capacity' } } }
    ]);

    const responseData = {
      totalTables,
      totalCapacity: totalCapacity[0]?.total || 0,
      statusBreakdown: stats
    };

    return ResponseHelper.success(res, responseData, "Table statistics fetched successfully",200);
  } catch (error) {
    return ResponseHelper.error(res, "Internal server error", 500, [error.message]);
  }
};
