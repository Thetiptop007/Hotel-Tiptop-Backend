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
    // Group booking support - additional guests
    groupSize: {
        type: Number,
        default: 1,
        min: [1, 'Group size must be at least 1'],
        max: [20, 'Group size cannot exceed 20 people']
    },
    additionalGuests: [{
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: [100, 'Guest name cannot exceed 100 characters']
        },
        mobile: {
            type: String,
            required: false,
            validate: {
                validator: function (v) {
                    // Only validate if value is provided and not empty
                    return !v || v === '' || /^[6-9]\d{9}$/.test(v);
                },
                message: 'Please enter a valid mobile number (10 digits starting with 6-9)'
            }
        },
        aadhaar: {
            type: String,
            required: false,
            validate: {
                validator: function (v) {
                    // Only validate if value is provided and not empty
                    return !v || v === '' || /^\d{4}-\d{4}-\d{4}$/.test(v);
                },
                message: 'Please enter Aadhaar in XXXX-XXXX-XXXX format'
            }
        },
        documents: [{
            type: String // Cloudinary URLs for this guest's documents
        }],
        documentPublicIds: [{
            type: String // Cloudinary public IDs for this guest's documents
        }],
        documentTypes: [{
            type: String,
            enum: ['aadhaar', 'aadhaar-front', 'aadhaar-back', 'passport', 'driving-license', 'other']
        }],
        relationship: {
            type: String,
            default: 'Guest',
            maxlength: [50, 'Relationship cannot exceed 50 characters']
        }
    }],
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
        type: String, // Type of document (e.g., 'aadhaar-front', 'aadhaar-back', etc.)
        enum: ['aadhaar', 'aadhaar-front', 'aadhaar-back', 'passport', 'driving-license', 'other']
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

// Validate check-out date is not before check-in date (same day checkout allowed)
bookingSchema.pre('validate', function (next) {
    if (this.checkOut && this.checkIn && this.checkOut < this.checkIn) {
        next(new Error('Check-out date cannot be before check-in date'));
    } else {
        next();
    }
});

// Calculate total amount based on dates and rent
bookingSchema.pre('save', function (next) {
    // Update group size based on additional guests
    this.groupSize = 1 + (this.additionalGuests ? this.additionalGuests.length : 0);

    if (this.checkIn && this.checkOut && this.rent) {
        const days = Math.ceil((this.checkOut - this.checkIn) / (1000 * 60 * 60 * 24));
        // Ensure minimum 1 day charge for same-day checkout
        this.totalAmount = Math.max(days, 1) * this.rent;
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

// Text index for full-text search across multiple fields including additional guests
bookingSchema.index({
    customerName: 'text',
    customerMobile: 'text',
    room: 'text',
    serialNo: 'text',
    'additionalGuests.name': 'text',
    'additionalGuests.mobile': 'text'
}, {
    weights: {
        customerName: 10,
        customerMobile: 8,
        serialNo: 6,
        room: 4,
        'additionalGuests.name': 7,
        'additionalGuests.mobile': 5
    },
    name: 'booking_text_index'
});

// Sparse index for optional fields
bookingSchema.index({ room: 1 }, { sparse: true });
bookingSchema.index({ customerAadhaar: 1 }, { sparse: true });

module.exports = mongoose.model('Booking', bookingSchema);
