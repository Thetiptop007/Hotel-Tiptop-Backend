const express = require('express');
const { body } = require('express-validator');
const {
    register,
    login,
    logout,
    getMe,
    updateProfile,
    changePassword,
    registerAdmin  // Add temporary admin registration
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Validation middleware
const registerValidation = [
    body('username')
        .isLength({ min: 3, max: 20 })
        .withMessage('Username must be between 3 and 20 characters')
        .matches(/^[a-zA-Z0-9_]+$/)
        .withMessage('Username can only contain letters, numbers, and underscores'),
    body('email')
        .isEmail()
        .normalizeEmail()
        .withMessage('Please provide a valid email'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('Password must be at least 6 characters long')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number')
];

const loginValidation = [
    body('username')
        .notEmpty()
        .withMessage('Username is required'),
    body('password')
        .notEmpty()
        .withMessage('Password is required')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.put('/change-password', protect, changePassword);

// TEMPORARY ADMIN REGISTRATION - REMOVE IN PRODUCTION
// Special admin registration route with additional security
router.post('/register-admin', [
    ...registerValidation,
    body('adminKey')
        .equals('TEMP_ADMIN_REGISTRATION_KEY_2024')
        .withMessage('Invalid admin registration key')
], registerAdmin);

module.exports = router;
