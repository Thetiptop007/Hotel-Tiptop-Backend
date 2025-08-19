const mongoose = require('mongoose');

// This model stores aggregate data for customers whose detailed records have been archived
const customerSummarySchema = new mongoose.Schema({
    customerId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    mobile: {
        type: String,
        required: true
    },
    aadhaar: {
        type: String,
        required: true
    },
    totalHistoricVisits: {
        type: Number,
        default: 0
    },
    totalHistoricRevenue: {
        type: Number,
        default: 0
    },
    firstVisit: {
        type: Date
    },
    lastArchivedVisit: {
        type: Date
    },
    archivedAt: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Create indexes
customerSummarySchema.index({ mobile: 1 });
customerSummarySchema.index({ aadhaar: 1 });

module.exports = mongoose.model('CustomerSummary', customerSummarySchema);
