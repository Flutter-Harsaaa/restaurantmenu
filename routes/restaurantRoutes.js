const express = require("express");
const router = express.Router();
const restaurantController = require("../controllers/restaurantController");
const authMiddleware = require("../middleware/authMiddleware");
const {createCategory,getCategories,updateCategory,deleteCategory} =require("../controllers/categoryController.js");
const {createMenuItem,getMenuItems,getMenuItem,updateMenuItem,deleteMenuItem} = require('../controllers/menuItemController');
const {createTable,getAllTables,getTableById,updateTable,deleteTable,getTableStats} = require("../controllers/tableController.js");
const upload = require('../middleware/uploadMiddleware');

//restaurants Api's 

router.post("/register",authMiddleware,upload.single('logo'),restaurantController.registerRestaurant);
router.put("/update/:id",authMiddleware,upload.single('logo'),restaurantController.updateRestaurant);
router.get("/all-restaurant/",authMiddleware,restaurantController.getAllRestaurants);
router.delete('/delete/:id',authMiddleware, restaurantController.deleteRestaurant);

//some routes are reamining 
// GET /api/restaurants/id/:id
router.get('/id/:id',authMiddleware, restaurantController.getRestaurantById);
//GET restaurant by id without middleware
router.get('/menu-restaurant/:id', restaurantController.getRestaurantById);

//categories Api's
router.post('/category/create-category/:restaurantId/categories',authMiddleware, createCategory);
router.get('/category/get-category/:restaurantId/categories',authMiddleware, getCategories);
//get categoory public api
router.get('/category/menu-get-category/:restaurantId/categories', getCategories);
router.put('/category/update-category/:restaurantId/categories/:categoryId',authMiddleware, updateCategory);
router.delete('/category/delete-category/:restaurantId/categories/:categoryId',authMiddleware, deleteCategory);

//menuItems Api's
//menuItems Api's
router.post('/menu/create-menu/:resId/items',authMiddleware, upload.array('images', 5), createMenuItem);
router.get('/menu/get-all-menu/:resId/items',authMiddleware, getMenuItems);
router.get('/menu/get-menu/:resId/items/:itemId',authMiddleware, getMenuItem);
//get by id public api
router.get('/menu/getmenus/:resId/items', getMenuItems);
router.get('/menu/getmenu/:resId/items/:itemId', getMenuItem);
router.put('/menu/update-menu/:resId/items/:itemId',authMiddleware, upload.array('images', 5), updateMenuItem);
router.delete('/menu/delete-menu/:resId/items/:itemId',authMiddleware, deleteMenuItem);

// Table APIs (add these to your existing routes)
router.post('/create-table/:restaurantId/tables',authMiddleware, createTable);
router.get('/get-tables/:restaurantId/tables',authMiddleware, getAllTables);
router.get('/get-table/:restaurantId/tables/:tableId',authMiddleware, getTableById);
//get by id public api
router.get('/menu/get-table/:restaurantId/tables/:tableId', getTableById);
router.put('/update-table/:restaurantId/tables/:tableId',authMiddleware, updateTable);
router.delete('/delete-table/:restaurantId/tables/:tableId',authMiddleware, deleteTable);
router.get('/table-stats/:restaurantId/tables/stats',authMiddleware, getTableStats);

module.exports = router;
