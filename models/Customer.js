const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Customer name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    mobile: {
        type: String,
        required: [true, 'Mobile number is required'],
        unique: true,
        match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit mobile number']
    },
    aadhaar: {
        type: String,
        required: [true, 'Aadhaar number is required'],
        unique: true,
        match: [/^[0-9]{4}-[0-9]{4}-[0-9]{4}$/, 'Please enter a valid Aadhaar number (XXXX-XXXX-XXXX)']
    },
    aadhaarImage: {
        type: String, // Cloudinary URL
        default: null
    },
    totalVisits: {
        type: Number,
        default: 0
    },
    totalRevenue: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update updatedAt before saving
customerSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

// Create indexes for better search performance
customerSchema.index({ name: 'text' });

module.exports = mongoose.model('Customer', customerSchema);
