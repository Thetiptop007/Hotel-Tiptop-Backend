const { validationResult } = require('express-validator');
const User = require('../models/User');
const { sendTokenResponse } = require('../utils/auth');
const { sendResponse } = require('../utils/helpers');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendResponse(res, 400, false, 'Validation failed', { errors: errors.array() });
        }

        const { username, email, password, role } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return sendResponse(res, 400, false, 'User already exists with this email or username');
        }

        // Create user
        const user = await User.create({
            username,
            email,
            password,
            role: role || 'staff'
        });

        sendTokenResponse(user, 201, res, 'User registered successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Register admin (TEMPORARY - REMOVE IN PRODUCTION)
// @route   POST /api/auth/register-admin
// @access  Public (with admin key validation)
exports.registerAdmin = async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendResponse(res, 400, false, 'Validation failed', { errors: errors.array() });
        }

        const { username, email, password, adminKey } = req.body;

        // Double-check admin key (already validated by middleware)
        if (adminKey !== 'TEMP_ADMIN_REGISTRATION_KEY_2024') {
            return sendResponse(res, 403, false, 'Unauthorized admin registration attempt');
        }

        // Check if user already exists
        const existingUser = await User.findOne({
            $or: [{ email }, { username }]
        });

        if (existingUser) {
            return sendResponse(res, 400, false, 'User already exists with this email or username');
        }

        // Create admin user
        const user = await User.create({
            username,
            email,
            password,
            role: 'admin'  // Force admin role
        });

        console.log(`ADMIN REGISTERED: ${username} (${email}) - REMOVE THIS ROUTE IN PRODUCTION`);

        sendTokenResponse(user, 201, res, 'Admin registered successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendResponse(res, 400, false, 'Validation failed', { errors: errors.array() });
        }

        const { username, password } = req.body;

        // Check for user (include password in query)
        const user = await User.findOne({
            $or: [{ username }, { email: username }]
        }).select('+password');

        if (!user) {
            return sendResponse(res, 401, false, 'Invalid credentials');
        }

        // Check if password matches
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return sendResponse(res, 401, false, 'Invalid credentials');
        }

        // Check if user is active
        if (!user.isActive) {
            return sendResponse(res, 401, false, 'Account is deactivated');
        }

        // Update last login
        await user.updateLastLogin();

        sendTokenResponse(user, 200, res, 'Login successful');
    } catch (error) {
        next(error);
    }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Public
exports.logout = async (req, res, next) => {
    try {
        sendResponse(res, 200, true, 'Logout successful');
    } catch (error) {
        next(error);
    }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        sendResponse(res, 200, true, 'User data retrieved successfully', {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res, next) => {
    try {
        const { username, email } = req.body;

        const fieldsToUpdate = {};
        if (username) fieldsToUpdate.username = username;
        if (email) fieldsToUpdate.email = email;

        // Check if username or email already exists (excluding current user)
        if (username || email) {
            const existingUser = await User.findOne({
                _id: { $ne: req.user.id },
                $or: [
                    ...(username ? [{ username }] : []),
                    ...(email ? [{ email }] : [])
                ]
            });

            if (existingUser) {
                return sendResponse(res, 400, false, 'Username or email already exists');
            }
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            fieldsToUpdate,
            { new: true, runValidators: true }
        );

        sendResponse(res, 200, true, 'Profile updated successfully', {
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                role: user.role,
                isActive: user.isActive,
                lastLogin: user.lastLogin,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Change password
// @route   PUT /api/auth/change-password
// @access  Private
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return sendResponse(res, 400, false, 'Current password and new password are required');
        }

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);

        if (!isMatch) {
            return sendResponse(res, 400, false, 'Current password is incorrect');
        }

        // Validate new password
        if (newPassword.length < 6) {
            return sendResponse(res, 400, false, 'New password must be at least 6 characters long');
        }

        // Update password
        user.password = newPassword;
        await user.save();

        sendResponse(res, 200, true, 'Password changed successfully');
    } catch (error) {
        next(error);
    }
};
