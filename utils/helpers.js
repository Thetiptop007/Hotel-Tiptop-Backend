// Generate unique serial number
const generateSerialNo = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `S${timestamp.slice(-6)}${random}`;
};

// Generate unique entry number
const generateEntryNo = () => {
    const timestamp = Date.now().toString();
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `E${timestamp.slice(-6)}${random}`;
};

// Format Aadhaar number
const formatAadhaar = (aadhaar) => {
    const cleaned = aadhaar.replace(/\D/g, '');
    if (cleaned.length === 12) {
        return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
    }
    return aadhaar;
};

// Validate Aadhaar number
const isValidAadhaar = (aadhaar) => {
    const aadhaarRegex = /^[0-9]{4}-[0-9]{4}-[0-9]{4}$/;
    return aadhaarRegex.test(aadhaar);
};

// Validate mobile number
const isValidMobile = (mobile) => {
    const mobileRegex = /^[0-9]{10}$/;
    return mobileRegex.test(mobile);
};

// Calculate days between two dates
const calculateDays = (checkIn, checkOut) => {
    const timeDiff = new Date(checkOut) - new Date(checkIn);
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
};

// Get date range for last 2 years
const getTwoYearsDateRange = () => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setFullYear(startDate.getFullYear() - 2);

    return { startDate, endDate };
};

// Format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
    }).format(amount);
};

// Pagination helper
const getPagination = (page, limit) => {
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    return {
        page: pageNum,
        limit: limitNum,
        skip
    };
};

// API Response helper
const sendResponse = (res, statusCode, success, message, data = null, pagination = null) => {
    const response = {
        success,
        message,
        ...(data && { data }),
        ...(pagination && { pagination })
    };

    res.status(statusCode).json(response);
};

module.exports = {
    generateSerialNo,
    generateEntryNo,
    formatAadhaar,
    isValidAadhaar,
    isValidMobile,
    calculateDays,
    getTwoYearsDateRange,
    formatCurrency,
    getPagination,
    sendResponse
};
