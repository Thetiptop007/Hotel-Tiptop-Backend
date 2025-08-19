const express = require('express');
const {
    getDashboardStats,
    getRevenueAnalytics,
    getCustomerAnalytics,
    getOccupancyAnalytics,
    exportData
} = require('../controllers/analytics');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(protect);

// Routes
router.get('/dashboard', getDashboardStats);
router.get('/revenue', getRevenueAnalytics);
router.get('/customers', getCustomerAnalytics);
router.get('/occupancy', getOccupancyAnalytics);
router.get('/export', authorize('admin', 'manager'), exportData);

module.exports = router;
