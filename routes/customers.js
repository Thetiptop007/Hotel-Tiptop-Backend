const express = require('express');
const { body } = require('express-validator');
const {
    createCustomer,
    getCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomer,
    getCustomerHistory,
    uploadAadhaarImage
} = require('../controllers/customers');
const { protect } = require('../middleware/auth');
const upload = require('../config/multer');

const router = express.Router();

// Validation middleware
const customerValidation = [
    body('name')
        .isLength({ min: 2, max: 100 })
        .withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s]+$/)
        .withMessage('Name can only contain letters and spaces'),
    body('mobile')
        .matches(/^[0-9]{10}$/)
        .withMessage('Mobile number must be exactly 10 digits'),
    body('aadhaar')
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
        .isISO8601()
        .withMessage('Check-out date must be a valid date')
        .custom((checkOut, { req }) => {
            if (new Date(checkOut) <= new Date(req.body.checkIn)) {
                throw new Error('Check-out date must be after check-in date');
            }
            return true;
        })
];

// All routes require authentication
router.use(protect);

// Routes
router.route('/')
    .get(getCustomers)
    .post(customerValidation, createCustomer);

router.route('/search')
    .get(searchCustomer);

router.route('/:id')
    .get(getCustomer)
    .put(updateCustomer)
    .delete(deleteCustomer);

router.route('/:id/history')
    .get(getCustomerHistory);

router.route('/:id/aadhaar-image')
    .post(upload.single('aadhaarImage'), uploadAadhaarImage);

module.exports = router;
