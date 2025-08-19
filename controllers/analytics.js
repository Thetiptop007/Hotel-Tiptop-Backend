const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const CustomerSummary = require('../models/CustomerSummary');
const { sendResponse, getTwoYearsDateRange } = require('../utils/helpers');

// @desc    Get dashboard statistics - Optimized for large datasets
// @route   GET /api/analytics/dashboard
// @access  Private
exports.getDashboardStats = async (req, res, next) => {
    try {
        const today = new Date();
        const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

        // Use single aggregation pipeline for better performance on large datasets
        const dashboardStats = await Booking.aggregate([
            {
                $facet: {
                    // Total bookings count
                    totalBookings: [
                        { $count: "total" }
                    ],
                    // Today's revenue from bookings created today
                    todayRevenue: [
                        {
                            $match: {
                                createdAt: {
                                    $gte: startOfToday,
                                    $lte: endOfToday
                                },
                                status: { $in: ['checked-out', 'checked-in'] },
                                rent: { $exists: true, $ne: null, $type: "number" }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                todayRevenue: { $sum: '$rent' }
                            }
                        }
                    ],
                    // Active bookings (currently checked in)
                    activeBookings: [
                        {
                            $match: {
                                status: 'checked-in'
                            }
                        },
                        { $count: "total" }
                    ],
                    // Total revenue from all completed bookings
                    totalRevenue: [
                        {
                            $match: {
                                status: { $in: ['checked-out', 'checked-in'] },
                                rent: { $exists: true, $ne: null, $type: "number" }
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalRevenue: { $sum: '$rent' }
                            }
                        }
                    ],
                    // Recent bookings (last 5) with only necessary fields
                    recentBookings: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        {
                            $project: {
                                customerName: 1,
                                customerMobile: 1,
                                room: 1,
                                rent: 1,
                                checkIn: 1,
                                checkOut: 1,
                                status: 1,
                                createdAt: 1
                            }
                        }
                    ]
                }
            }
        ]);

        const stats = dashboardStats[0];

        // Extract results with fallback values and better debugging
        const result = {
            stats: {
                totalBookings: stats.totalBookings[0]?.total || 0,
                todayRevenue: stats.todayRevenue[0]?.todayRevenue || 0,
                activeBookings: stats.activeBookings[0]?.total || 0,
                totalRevenue: stats.totalRevenue[0]?.totalRevenue || 0
            },
            recentCustomers: stats.recentBookings || [] // Named as recentCustomers for frontend compatibility
        };

        console.log('Dashboard stats raw data:', {
            totalBookings: stats.totalBookings,
            todayRevenue: stats.todayRevenue,
            activeBookings: stats.activeBookings,
            totalRevenue: stats.totalRevenue,
            todayDateRange: { startOfToday, endOfToday }
        });

        console.log('Dashboard stats calculated:', result.stats);

        sendResponse(res, 200, true, 'Dashboard statistics retrieved successfully', result);
    } catch (error) {
        console.error('Dashboard stats error:', error);
        next(error);
    }
};

// @desc    Get revenue analytics - Optimized for large datasets
// @route   GET /api/analytics/revenue
// @access  Private
exports.getRevenueAnalytics = async (req, res, next) => {
    try {
        const { period = 'month', year, month } = req.query;

        let matchStage = {
            status: { $ne: 'cancelled' }
        };

        // Add date filtering based on period
        if (period === 'year' && year) {
            const startDate = new Date(year, 0, 1);
            const endDate = new Date(parseInt(year) + 1, 0, 1);
            matchStage.createdAt = { $gte: startDate, $lt: endDate };
        } else if (period === 'month' && year && month) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 1);
            matchStage.createdAt = { $gte: startDate, $lt: endDate };
        } else {
            // Default to last 12 months
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - 1);
            matchStage.createdAt = { $gte: startDate };
        }

        // Get revenue by period
        let groupStage;
        if (period === 'day') {
            groupStage = {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                }
            };
        } else if (period === 'month') {
            groupStage = {
                _id: {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                }
            };
        } else {
            groupStage = {
                _id: {
                    year: { $year: '$createdAt' }
                }
            };
        }

        const revenueData = await Booking.aggregate([
            { $match: matchStage },
            {
                $group: {
                    ...groupStage,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalBookings: { $sum: 1 },
                    averageRate: { $avg: '$rent' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Get revenue by room type/rate
        const revenueByRate = await Booking.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$rent',
                    totalRevenue: { $sum: '$totalAmount' },
                    bookings: { $sum: 1 }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        sendResponse(res, 200, true, 'Revenue analytics retrieved successfully', {
            revenueData,
            revenueByRate
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer analytics
// @route   GET /api/analytics/customers
// @access  Private
exports.getCustomerAnalytics = async (req, res, next) => {
    try {
        const { startDate } = getTwoYearsDateRange();

        // New vs returning customers
        const customerTypes = await Booking.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $lookup: {
                    from: 'bookings',
                    let: { customerId: '$customer' },
                    pipeline: [
                        { $match: { $expr: { $eq: ['$customer', '$$customerId'] } } },
                        { $sort: { createdAt: 1 } },
                        { $limit: 1 }
                    ],
                    as: 'firstBooking'
                }
            },
            {
                $addFields: {
                    isFirstBooking: { $eq: [{ $arrayElemAt: ['$firstBooking._id', 0] }, '$_id'] }
                }
            },
            {
                $group: {
                    _id: '$isFirstBooking',
                    count: { $sum: 1 }
                }
            }
        ]);

        // Customer frequency distribution
        const customerFrequency = await Customer.aggregate([
            {
                $bucket: {
                    groupBy: '$totalVisits',
                    boundaries: [1, 2, 5, 10, 20, 50],
                    default: '50+',
                    output: {
                        count: { $sum: 1 },
                        customers: { $push: { name: '$name', visits: '$totalVisits' } }
                    }
                }
            }
        ]);

        // Top customers by revenue
        const topCustomers = await Customer.find({ isActive: true })
            .sort({ totalRevenue: -1 })
            .limit(10)
            .select('name mobile totalVisits totalRevenue');

        // Customer acquisition over time
        const acquisitionData = await Customer.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    newCustomers: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        sendResponse(res, 200, true, 'Customer analytics retrieved successfully', {
            customerTypes,
            customerFrequency,
            topCustomers,
            acquisitionData
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get occupancy analytics
// @route   GET /api/analytics/occupancy
// @access  Private
exports.getOccupancyAnalytics = async (req, res, next) => {
    try {
        const { startDate, endDate } = getTwoYearsDateRange();

        // Daily occupancy for the last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyOccupancy = await Booking.aggregate([
            {
                $match: {
                    $or: [
                        { checkIn: { $gte: thirtyDaysAgo, $lte: new Date() } },
                        { checkOut: { $gte: thirtyDaysAgo, $lte: new Date() } },
                        { checkIn: { $lte: thirtyDaysAgo }, checkOut: { $gte: new Date() } }
                    ],
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $project: {
                    room: 1,
                    checkIn: 1,
                    checkOut: 1,
                    dates: {
                        $map: {
                            input: { $range: [0, { $add: [{ $divide: [{ $subtract: ['$checkOut', '$checkIn'] }, 86400000] }, 1] }] },
                            as: 'day',
                            in: {
                                $dateFromString: {
                                    dateString: {
                                        $dateToString: {
                                            format: '%Y-%m-%d',
                                            date: { $add: ['$checkIn', { $multiply: ['$$day', 86400000] }] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            { $unwind: '$dates' },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$dates' } },
                    occupiedRooms: { $addToSet: '$room' },
                    bookings: { $sum: 1 }
                }
            },
            {
                $project: {
                    date: '$_id',
                    occupiedRooms: { $size: '$occupiedRooms' },
                    bookings: 1
                }
            },
            { $sort: { date: 1 } }
        ]);

        // Room utilization
        const roomUtilization = await Booking.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: '$room',
                    bookings: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' },
                    averageRate: { $avg: '$rent' },
                    totalDays: {
                        $sum: {
                            $ceil: {
                                $divide: [{ $subtract: ['$checkOut', '$checkIn'] }, 86400000]
                            }
                        }
                    }
                }
            },
            { $sort: { totalRevenue: -1 } }
        ]);

        // Average length of stay
        const averageStay = await Booking.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $ne: 'cancelled' }
                }
            },
            {
                $group: {
                    _id: null,
                    averageDays: {
                        $avg: {
                            $ceil: {
                                $divide: [{ $subtract: ['$checkOut', '$checkIn'] }, 86400000]
                            }
                        }
                    },
                    totalBookings: { $sum: 1 }
                }
            }
        ]);

        sendResponse(res, 200, true, 'Occupancy analytics retrieved successfully', {
            dailyOccupancy,
            roomUtilization,
            averageStay: averageStay[0] || { averageDays: 0, totalBookings: 0 }
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Export data
// @route   GET /api/analytics/export
// @access  Private (Admin/Manager only)
exports.exportData = async (req, res, next) => {
    try {
        const { type = 'customers', format = 'json', startDate, endDate } = req.query;

        let query = {};
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else {
            // Default to last 2 years
            const { startDate: defaultStart } = getTwoYearsDateRange();
            query.createdAt = { $gte: defaultStart };
        }

        let data;
        if (type === 'customers') {
            data = await Customer.find(query).select('-__v');
        } else if (type === 'bookings') {
            data = await Booking.find(query).populate('customer', 'name mobile aadhaar').select('-__v');
        } else {
            return sendResponse(res, 400, false, 'Invalid export type. Use "customers" or "bookings"');
        }

        if (format === 'csv') {
            // Convert to CSV format
            const csvData = convertToCSV(data);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=${type}_export.csv`);
            res.send(csvData);
        } else {
            // Return JSON
            sendResponse(res, 200, true, 'Data exported successfully', { data, count: data.length });
        }
    } catch (error) {
        next(error);
    }
};

// Helper function to convert data to CSV
const convertToCSV = (data) => {
    if (!data.length) return '';

    const headers = Object.keys(data[0].toObject ? data[0].toObject() : data[0]);
    const csvRows = [headers.join(',')];

    data.forEach(row => {
        const obj = row.toObject ? row.toObject() : row;
        const values = headers.map(header => {
            const value = obj[header];
            return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
        });
        csvRows.push(values.join(','));
    });

    return csvRows.join('\n');
};
