const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    serialNo: {
        type: String,
        required: true,
        unique: true
    },
    entryNo: {
        type: String,
        required: true,
        unique: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: false // Made optional since we're embedding customer data
    },
    customerName: {
        type: String,
        required: true
    },
    customerMobile: {
        type: String,
        required: true
    },
    customerAadhaar: {
        type: String,
        required: true
    },
    room: {
        type: String,
        required: false,
        default: 'TBD',
        maxlength: [10, 'Room number cannot exceed 10 characters']
    },
    rent: {
        type: Number,
        required: [true, 'Room rent is required'],
        min: [0, 'Rent cannot be negative']
    },
    checkIn: {
        type: Date,
        required: [true, 'Check-in date is required']
    },
    checkOut: {
        type: Date,
        required: false,
        default: null
    },
    status: {
        type: String,
        enum: ['checked-in', 'checked-out', 'cancelled'],
        default: 'checked-in'
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'partial'],
        default: 'pending'
    },
    totalAmount: {
        type: Number,
        default: 0
    },
    notes: {
        type: String,
        maxlength: [500, 'Notes cannot exceed 500 characters']
    },
    documents: [{
        type: String // Cloudinary URLs
    }],
    documentPublicIds: [{
        type: String // Cloudinary public IDs for deletion
    }],
    documentTypes: [{
        type: String, // Type of document (e.g., 'aadhaar', 'passport', etc.)
        enum: ['aadhaar', 'passport', 'driving-license', 'other']
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Made optional for simplified booking
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

// Validate check-out date is after check-in date (only when checkOut is provided)
bookingSchema.pre('validate', function (next) {
    if (this.checkOut && this.checkIn && this.checkOut <= this.checkIn) {
        next(new Error('Check-out date must be after check-in date'));
    } else {
        next();
    }
});

// Calculate total amount based on dates and rent
bookingSchema.pre('save', function (next) {
    if (this.checkIn && this.checkOut && this.rent) {
        const days = Math.ceil((this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
        this.totalAmount = days * this.rent;
    }
    this.updatedAt = Date.now();
    next();
});

// Create indexes for better query performance with large datasets
bookingSchema.index({ customer: 1 });
bookingSchema.index({ checkIn: 1 });
bookingSchema.index({ checkOut: 1 });
bookingSchema.index({ status: 1 });
bookingSchema.index({ createdAt: -1 });

// Compound indexes for common query patterns
bookingSchema.index({ status: 1, checkIn: -1 }); // Status with check-in date
bookingSchema.index({ customerMobile: 1, status: 1 }); // Customer search with status
bookingSchema.index({ checkIn: 1, checkOut: 1 }); // Date range queries
bookingSchema.index({ rent: -1, checkIn: -1 }); // Sort by rent with date

// Text index for full-text search across multiple fields
bookingSchema.index({
    customerName: 'text',
    customerMobile: 'text',
    room: 'text',
    serialNo: 'text'
}, {
    weights: {
        customerName: 10,
        customerMobile: 8,
        serialNo: 6,
        room: 4
    },
    name: 'booking_text_index'
});

// Sparse index for optional fields
bookingSchema.index({ room: 1 }, { sparse: true });
bookingSchema.index({ customerAadhaar: 1 }, { sparse: true });

module.exports = mongoose.model('Booking', bookingSchema);
