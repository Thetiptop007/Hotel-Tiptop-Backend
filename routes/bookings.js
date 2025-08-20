const express = require('express');
const { body } = require('express-validator');
const {
    createBooking,
    getBookings,
    getBooking,
    updateBooking,
    deleteBooking,
    searchBookings,
    getBookingsByDateRange,
    updateBookingStatus,
    advancedSearch,
    getBookingStats,
    searchCustomer
} = require('../controllers/bookings');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation middleware for creating booking
const bookingValidation = [
    body('customerName')
        .isLength({ min: 2, max: 100 })
        .withMessage('Customer name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Customer name can only contain letters and spaces'),
    body('customerMobile')
        .matches(/^[0-9]{10}$/)
        .withMessage('Mobile number must be exactly 10 digits'),
    body('customerAadhaar')
        .optional()
        .matches(/^[0-9]{4}-[0-9]{4}-[0-9]{4}$/)
        .withMessage('Aadhaar number must be in format XXXX-XXXX-XXXX'),
    body('room')
        .optional()
        .isLength({ min: 1, max: 10 })
        .withMessage('Room number cannot exceed 10 characters'),
    body('rent')
        .isNumeric()
        .withMessage('Rent must be a number')
        .isFloat({ min: 1 })
        .withMessage('Rent must be greater than 0'),
    body('checkIn')
        .isISO8601()
        .withMessage('Check-in date must be a valid date'),
    body('checkOut')
        .optional()
        .isISO8601()
        .withMessage('Check-out date must be a valid date')
        .custom((checkOut, { req }) => {
            if (checkOut && req.body.checkIn && new Date(checkOut) <= new Date(req.body.checkIn)) {
                throw new Error('Check-out date must be after check-in date');
            }
            return true;
        }),
    body('status')
        .optional()
        .isIn(['checked-in', 'checked-out'])
        .withMessage('Status must be either checked-in or checked-out')
];

// Validation for status update
const statusValidation = [
    body('status')
        .isIn(['checked-in', 'checked-out'])
        .withMessage('Status must be either checked-in or checked-out')
];

// All routes require authentication
router.use(protect);

// Routes
router.route('/')
    .get(getBookings)
    .post(bookingValidation, createBooking);

router.route('/search')
    .get(searchBookings);

router.route('/advanced-search')
    .get(advancedSearch);

router.route('/stats')
    .get(getBookingStats);

router.route('/search-customer')
    .get(searchCustomer);

router.route('/date-range')
    .get(getBookingsByDateRange);

router.route('/:id')
    .get(getBooking)
    .put(updateBooking)
    .delete(deleteBooking);

router.route('/:id/status')
    .put(statusValidation, updateBookingStatus);

module.exports = router;
