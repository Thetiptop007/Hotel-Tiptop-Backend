const { validationResult } = require('express-validator');
const Booking = require('../models/Booking');
const Customer = require('../models/Customer');
const { sendResponse, generateSerialNo, generateEntryNo } = require('../utils/helpers');

// @desc    Get all bookings with pagination, search, and filters - Optimized for large datasets
// @route   GET /api/bookings
// @access  Private
exports.getBookings = async (req, res, next) => {
    try {
        console.log('Getting bookings - Query params:', req.query);

        const page = parseInt(req.query.page) || 1;
        const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Limit max page size
        const skip = (page - 1) * limit;
        const search = req.query.search || '';
        const status = req.query.status;
        const sortBy = req.query.sortBy || 'checkIn';
        const startDate = req.query.startDate;
        const endDate = req.query.endDate;

        // Build match query with optimized conditions
        let matchQuery = {};

        // Date range filter for better performance
        if (startDate || endDate) {
            matchQuery.checkIn = {};
            if (startDate) matchQuery.checkIn.$gte = new Date(startDate);
            if (endDate) matchQuery.checkIn.$lte = new Date(endDate);
        }

        // Status filter
        if (status && status !== 'all' && status !== 'undefined') {
            matchQuery.status = status;
        }

        // Optimized search using text index for large datasets
        if (search) {
            // Use text search for better performance on large datasets
            if (search.length >= 3) { // Only use text search for meaningful queries
                matchQuery.$text = { $search: search };
            } else {
                // For short queries, use regex on indexed fields
                matchQuery.$or = [
                    { customerMobile: { $regex: `^${search}`, $options: 'i' } }, // Prefix search on mobile
                    { serialNo: { $regex: `^${search}`, $options: 'i' } } // Prefix search on serial number
                ];
            }
        }

        // Sort configuration with index-friendly sorting
        let sortConfig = { checkIn: -1 }; // Default: newest first
        switch (sortBy) {
            case 'customerName':
                sortConfig = { customerName: 1 };
                break;
            case 'rent':
                sortConfig = { rent: -1, checkIn: -1 }; // Secondary sort for consistency
                break;
            case 'room':
                sortConfig = { room: 1, checkIn: -1 };
                break;
            case 'checkIn':
                sortConfig = { checkIn: -1 };
                break;
            case 'status':
                sortConfig = { status: 1, checkIn: -1 };
                break;
        }

        console.log('Booking query match:', matchQuery);
        console.log('Booking sort config:', sortConfig);

        // Optimized aggregation pipeline for large datasets
        const pipeline = [
            { $match: matchQuery },
            // Add text search score for relevant sorting when using text search
            ...(search.length >= 3 && matchQuery.$text ? [
                { $addFields: { score: { $meta: "textScore" } } }
            ] : []),
            // Efficient sorting
            {
                $sort: search.length >= 3 && matchQuery.$text ?
                    { score: { $meta: "textScore" }, ...sortConfig } :
                    sortConfig
            },
            { $skip: skip },
            { $limit: limit },
            // Project only needed fields to reduce memory usage
            {
                $project: {
                    serialNo: 1,
                    entryNo: 1,
                    customerName: 1,
                    customerMobile: 1,
                    customerAadhaar: 1,
                    room: 1,
                    rent: 1,
                    checkIn: 1,
                    checkOut: 1,
                    status: 1,
                    totalAmount: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    ...(search.length >= 3 && matchQuery.$text ? { score: 1 } : {})
                }
            }
        ];

        // Execute aggregation
        const bookings = await Booking.aggregate(pipeline);

        // Use countDocuments with the same match query for accurate pagination
        const totalCount = await Booking.countDocuments(matchQuery);
        const totalPages = Math.ceil(totalCount / limit);

        console.log('Bookings found:', bookings.length);
        console.log('Total bookings count:', totalCount);

        const pagination = {
            page,
            limit,
            totalPages,
            totalCount,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        };

        sendResponse(res, 200, true, 'Bookings retrieved successfully', {
            bookings,
            pagination
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Create new booking
// @route   POST /api/bookings
// @access  Private
exports.createBooking = async (req, res, next) => {
    try {
        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return sendResponse(res, 400, false, 'Validation failed', { errors: errors.array() });
        }

        const {
            customerName,
            customerMobile,
            customerAadhaar,
            room,
            rent,
            checkIn,
            checkOut,
            status = 'checked-in'
        } = req.body;

        // Generate unique identifiers
        const serialNo = generateSerialNo();
        const entryNo = generateEntryNo();

        // Create booking with embedded customer data
        const newBooking = new Booking({
            serialNo,
            entryNo,
            customerName,
            customerMobile,
            customerAadhaar,
            room: room || 'TBD',
            rent,
            checkIn: new Date(checkIn),
            checkOut: checkOut ? new Date(checkOut) : null,
            status
        });

        const savedBooking = await newBooking.save();

        console.log('Booking created successfully:', savedBooking);

        sendResponse(res, 201, true, 'Booking created successfully', { booking: savedBooking });
    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyValue)[0];
            const message = `A booking with this ${field} already exists`;
            return sendResponse(res, 400, false, message);
        }
        next(error);
    }
};

// @desc    Get single booking
// @route   GET /api/bookings/:id
// @access  Private
exports.getBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Booking not found');
        }

        sendResponse(res, 200, true, 'Booking retrieved successfully', { booking });
    } catch (error) {
        next(error);
    }
};

// @desc    Update booking
// @route   PUT /api/bookings/:id
// @access  Private
exports.updateBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Booking not found');
        }

        // Update booking fields
        Object.keys(req.body).forEach(key => {
            if (req.body[key] !== undefined) {
                booking[key] = req.body[key];
            }
        });

        const updatedBooking = await booking.save();

        sendResponse(res, 200, true, 'Booking updated successfully', { booking: updatedBooking });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete booking
// @route   DELETE /api/bookings/:id
// @access  Private
exports.deleteBooking = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Booking not found');
        }

        await Booking.findByIdAndDelete(req.params.id);

        sendResponse(res, 200, true, 'Booking deleted successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Search bookings
// @route   GET /api/bookings/search
// @access  Private
exports.searchBookings = async (req, res, next) => {
    try {
        const { q } = req.query;

        if (!q) {
            return sendResponse(res, 400, false, 'Search query is required');
        }

        const bookings = await Booking.find({
            $or: [
                { customerName: { $regex: q, $options: 'i' } },
                { customerMobile: { $regex: q, $options: 'i' } },
                { room: { $regex: q, $options: 'i' } },
                { serialNo: { $regex: q, $options: 'i' } }
            ]
        }).sort({ checkIn: -1 });

        sendResponse(res, 200, true, 'Search completed successfully', { bookings });
    } catch (error) {
        next(error);
    }
};

// @desc    Get bookings by date range
// @route   GET /api/bookings/date-range
// @access  Private
exports.getBookingsByDateRange = async (req, res, next) => {
    try {
        const { start, end } = req.query;

        if (!start || !end) {
            return sendResponse(res, 400, false, 'Start and end dates are required');
        }

        const startDate = new Date(start);
        const endDate = new Date(end);

        const bookings = await Booking.find({
            checkIn: {
                $gte: startDate,
                $lte: endDate
            }
        }).sort({ checkIn: -1 });

        sendResponse(res, 200, true, 'Bookings retrieved successfully', { bookings });
    } catch (error) {
        next(error);
    }
};

// @desc    Update booking status
// @route   PUT /api/bookings/:id/status
// @access  Private
exports.updateBookingStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Booking not found');
        }

        booking.status = status;
        const updatedBooking = await booking.save();

        sendResponse(res, 200, true, 'Booking status updated successfully', { booking: updatedBooking });
    } catch (error) {
        next(error);
    }
};

// @desc    Advanced search for large datasets with caching
// @route   GET /api/bookings/advanced-search
// @access  Private
exports.advancedSearch = async (req, res, next) => {
    try {
        const {
            query,
            page = 1,
            limit = 20,
            sortBy = 'relevance',
            status,
            dateFrom,
            dateTo,
            minRent,
            maxRent
        } = req.query;

        if (!query || query.length < 2) {
            return sendResponse(res, 400, false, 'Search query must be at least 2 characters');
        }

        const pageNum = parseInt(page);
        const limitNum = Math.min(parseInt(limit), 50); // Max 50 results per page
        const skip = (pageNum - 1) * limitNum;

        // Build advanced match query
        let matchQuery = {};

        // Text search
        if (query.length >= 3) {
            matchQuery.$text = { $search: query };
        } else {
            // For short queries, use optimized prefix search
            const numericQuery = /^\d+$/.test(query);
            if (numericQuery) {
                matchQuery.$or = [
                    { customerMobile: { $regex: `^${query}` } },
                    { serialNo: { $regex: `^${query}`, $options: 'i' } },
                    { room: { $regex: `^${query}`, $options: 'i' } }
                ];
            } else {
                matchQuery.$or = [
                    { customerName: { $regex: `^${query}`, $options: 'i' } },
                    { serialNo: { $regex: `^${query}`, $options: 'i' } }
                ];
            }
        }

        // Advanced filters
        if (status && status !== 'all') {
            matchQuery.status = status;
        }

        if (dateFrom || dateTo) {
            matchQuery.checkIn = {};
            if (dateFrom) matchQuery.checkIn.$gte = new Date(dateFrom);
            if (dateTo) matchQuery.checkIn.$lte = new Date(dateTo);
        }

        if (minRent || maxRent) {
            matchQuery.rent = {};
            if (minRent) matchQuery.rent.$gte = parseInt(minRent);
            if (maxRent) matchQuery.rent.$lte = parseInt(maxRent);
        }

        // Sort configuration
        let sortConfig;
        switch (sortBy) {
            case 'relevance':
                sortConfig = query.length >= 3 ?
                    { score: { $meta: "textScore" }, checkIn: -1 } :
                    { checkIn: -1 };
                break;
            case 'date-newest':
                sortConfig = { checkIn: -1 };
                break;
            case 'date-oldest':
                sortConfig = { checkIn: 1 };
                break;
            case 'rent-high':
                sortConfig = { rent: -1, checkIn: -1 };
                break;
            case 'rent-low':
                sortConfig = { rent: 1, checkIn: -1 };
                break;
            case 'name':
                sortConfig = { customerName: 1 };
                break;
            default:
                sortConfig = { checkIn: -1 };
        }

        // Build aggregation pipeline
        const pipeline = [
            { $match: matchQuery },
            ...(query.length >= 3 && matchQuery.$text ? [
                { $addFields: { score: { $meta: "textScore" } } }
            ] : []),
            { $sort: sortConfig },
            { $skip: skip },
            { $limit: limitNum },
            {
                $project: {
                    serialNo: 1,
                    customerName: 1,
                    customerMobile: 1,
                    room: 1,
                    rent: 1,
                    checkIn: 1,
                    checkOut: 1,
                    status: 1,
                    totalAmount: 1,
                    ...(query.length >= 3 && matchQuery.$text ? { score: 1 } : {})
                }
            }
        ];

        // Execute search
        const [results, totalCount] = await Promise.all([
            Booking.aggregate(pipeline),
            Booking.countDocuments(matchQuery)
        ]);

        const totalPages = Math.ceil(totalCount / limitNum);

        sendResponse(res, 200, true, 'Advanced search completed', {
            bookings: results,
            pagination: {
                page: pageNum,
                limit: limitNum,
                totalPages,
                totalCount,
                hasNextPage: pageNum < totalPages,
                hasPrevPage: pageNum > 1
            },
            searchMeta: {
                query,
                resultCount: results.length,
                searchTime: Date.now()
            }
        });

    } catch (error) {
        next(error);
    }
};

// @desc    Get booking statistics for dashboard - optimized for large datasets
// @route   GET /api/bookings/stats
// @access  Private
exports.getBookingStats = async (req, res, next) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Use aggregation for better performance on large datasets
        const stats = await Booking.aggregate([
            {
                $facet: {
                    totalBookings: [{ $count: "count" }],
                    todayCheckIns: [
                        { $match: { checkIn: { $gte: today, $lt: tomorrow } } },
                        { $count: "count" }
                    ],
                    activeBookings: [
                        { $match: { status: "checked-in" } },
                        { $count: "count" }
                    ],
                    totalRevenue: [
                        { $match: { status: { $in: ["checked-out", "checked-in"] } } },
                        { $group: { _id: null, total: { $sum: "$rent" } } }
                    ],
                    recentBookings: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                customerName: 1,
                                room: 1,
                                checkIn: 1,
                                status: 1,
                                rent: 1
                            }
                        }
                    ]
                }
            }
        ]);

        const result = stats[0];

        sendResponse(res, 200, true, 'Booking statistics retrieved', {
            stats: {
                totalBookings: result.totalBookings[0]?.count || 0,
                todayCheckIns: result.todayCheckIns[0]?.count || 0,
                activeBookings: result.activeBookings[0]?.count || 0,
                totalRevenue: result.totalRevenue[0]?.total || 0
            },
            recentBookings: result.recentBookings
        });

    } catch (error) {
        next(error);
    }
};
