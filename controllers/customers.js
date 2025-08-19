const { validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
const CustomerSummary = require('../models/CustomerSummary');
const {
    sendResponse,
    getPagination,
    generateSerialNo,
    generateEntryNo,
    formatAadhaar,
    getTwoYearsDateRange
} = require('../utils/helpers');
const cloudinary = require('../config/cloudinary');

// @desc    Create new customer and booking
// @route   POST /api/customers
// @access  Private
exports.createCustomer = async (req, res) => {
    try {
        console.log('Received customer data:', req.body);

        // Check for validation errors
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            console.log('Validation errors:', errors.array());
            return sendResponse(res, 400, false, 'Validation failed', { errors: errors.array() });
        }
        if (!errors.isEmpty()) {
            return sendResponse(res, 400, false, 'Validation failed', { errors: errors.array() });
        }

        const { name, mobile, aadhaar, room = 'TBD', rent, checkIn, checkOut, notes } = req.body;

        // Format Aadhaar number
        const formattedAadhaar = formatAadhaar(aadhaar);

        // Check if customer already exists
        let customer = await Customer.findOne({
            $or: [{ mobile }, { aadhaar: formattedAadhaar }]
        });

        if (!customer) {
            // Create new customer
            customer = await Customer.create({
                name,
                mobile,
                aadhaar: formattedAadhaar,
                totalVisits: 1,
                totalRevenue: rent
            });
        } else {
            // Update existing customer
            customer.totalVisits += 1;
            customer.totalRevenue += parseInt(rent);
            await customer.save();
        }

        // Create booking
        const booking = await Booking.create({
            serialNo: generateSerialNo(),
            entryNo: generateEntryNo(),
            customer: customer._id,
            customerName: customer.name,
            customerMobile: customer.mobile,
            customerAadhaar: customer.aadhaar,
            room,
            rent: parseInt(rent),
            checkIn: new Date(checkIn),
            checkOut: new Date(checkOut),
            notes,
            createdBy: req.user.id
        });

        // Populate customer details in booking
        await booking.populate('customer');

        sendResponse(res, 201, true, 'Customer and booking created successfully', {
            customer,
            booking
        });
    } catch (error) {
        if (error.code === 11000) {
            // Handle duplicate key error
            const field = Object.keys(error.keyPattern)[0];
            return sendResponse(res, 400, false, `Customer with this ${field} already exists`);
        }
        next(error);
    }
};

// @desc    Get all customers with pagination
// @route   GET /api/customers
// @access  Private
exports.getCustomers = async (req, res, next) => {
    try {
        const { page = 1, limit = 10, search, status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;

        const { page: pageNum, limit: limitNum, skip } = getPagination(page, limit);

        // Build query - remove the 2-year restriction to show all bookings
        let bookingsQuery = {};

        if (status && status !== 'all') {
            bookingsQuery.status = status;
        }

        // Add search to bookings query
        if (search) {
            bookingsQuery.$or = [
                { customerName: { $regex: search, $options: 'i' } },
                { customerMobile: { $regex: search, $options: 'i' } },
                { customerAadhaar: { $regex: search, $options: 'i' } },
                { serialNo: { $regex: search, $options: 'i' } },
                { entryNo: { $regex: search, $options: 'i' } }
            ];
        }

        // Get total count
        const totalBookings = await Booking.countDocuments(bookingsQuery);

        // Get bookings with pagination
        const bookings = await Booking.find(bookingsQuery)
            .populate('customer')
            .sort({ [sortBy]: sortOrder === 'desc' ? -1 : 1 })
            .skip(skip)
            .limit(limitNum);

        // Transform data for frontend
        const customers = bookings.map(booking => ({
            _id: booking._id, // Use _id instead of id for MongoDB
            id: booking._id,
            serialNo: booking.serialNo,
            entryNo: booking.entryNo,
            name: booking.customerName,
            mobile: booking.customerMobile,
            aadhaar: booking.customerAadhaar,
            aadhaarImage: booking.customer?.aadhaarImage || null,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            rent: booking.rent,
            room: booking.room,
            status: booking.status,
            totalVisits: booking.customer?.totalVisits || 1,
            totalAmount: booking.totalAmount,
            createdAt: booking.createdAt,
            latestBooking: {
                serialNo: booking.serialNo,
                rent: booking.rent,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                room: booking.room
            }
        }));

        const pagination = {
            page: pageNum,
            limit: limitNum,
            total: totalBookings,
            totalCount: totalBookings,
            pages: Math.ceil(totalBookings / limitNum)
        };

        sendResponse(res, 200, true, 'Customers retrieved successfully', { customers, totalCount: totalBookings, pagination }, pagination);
    } catch (error) {
        next(error);
    }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
exports.getCustomer = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('customer');

        if (!booking) {
            return sendResponse(res, 404, false, 'Customer booking not found');
        }

        const customerData = {
            id: booking._id,
            serialNo: booking.serialNo,
            entryNo: booking.entryNo,
            name: booking.customerName,
            mobile: booking.customerMobile,
            aadhaar: booking.customerAadhaar,
            aadhaarImage: booking.customer?.aadhaarImage || null,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            rent: booking.rent,
            room: booking.room,
            status: booking.status,
            totalVisits: booking.customer?.totalVisits || 1,
            totalAmount: booking.totalAmount,
            notes: booking.notes,
            createdAt: booking.createdAt
        };

        sendResponse(res, 200, true, 'Customer retrieved successfully', { customer: customerData });
    } catch (error) {
        next(error);
    }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
exports.updateCustomer = async (req, res, next) => {
    try {
        const { name, mobile, aadhaar, room, rent, checkIn, checkOut, status, notes } = req.body;

        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Customer booking not found');
        }

        // Update booking
        const updateData = {};
        if (name) updateData.customerName = name;
        if (mobile) updateData.customerMobile = mobile;
        if (aadhaar) updateData.customerAadhaar = formatAadhaar(aadhaar);
        if (room) updateData.room = room;
        if (rent) updateData.rent = parseInt(rent);
        if (checkIn) updateData.checkIn = new Date(checkIn);
        if (checkOut) updateData.checkOut = new Date(checkOut);
        if (status) updateData.status = status;
        if (notes !== undefined) updateData.notes = notes;

        const updatedBooking = await Booking.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate('customer');

        // Update customer record if name, mobile, or aadhaar changed
        if (name || mobile || aadhaar) {
            const customer = await Customer.findById(booking.customer);
            if (customer) {
                if (name) customer.name = name;
                if (mobile) customer.mobile = mobile;
                if (aadhaar) customer.aadhaar = formatAadhaar(aadhaar);
                await customer.save();
            }
        }

        const customerData = {
            id: updatedBooking._id,
            serialNo: updatedBooking.serialNo,
            entryNo: updatedBooking.entryNo,
            name: updatedBooking.customerName,
            mobile: updatedBooking.customerMobile,
            aadhaar: updatedBooking.customerAadhaar,
            aadhaarImage: updatedBooking.customer?.aadhaarImage || null,
            checkIn: updatedBooking.checkIn,
            checkOut: updatedBooking.checkOut,
            rent: updatedBooking.rent,
            room: updatedBooking.room,
            status: updatedBooking.status,
            totalVisits: updatedBooking.customer?.totalVisits || 1,
            totalAmount: updatedBooking.totalAmount,
            notes: updatedBooking.notes,
            createdAt: updatedBooking.createdAt
        };

        sendResponse(res, 200, true, 'Customer updated successfully', { customer: customerData });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete customer booking
// @route   DELETE /api/customers/:id
// @access  Private
exports.deleteCustomer = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return sendResponse(res, 404, false, 'Customer booking not found');
        }

        // Update customer totals
        const customer = await Customer.findById(booking.customer);
        if (customer) {
            customer.totalVisits = Math.max(0, customer.totalVisits - 1);
            customer.totalRevenue = Math.max(0, customer.totalRevenue - booking.rent);
            await customer.save();

            // If no more visits, delete customer record
            if (customer.totalVisits === 0) {
                await Customer.findByIdAndDelete(customer._id);
            }
        }

        await Booking.findByIdAndDelete(req.params.id);

        sendResponse(res, 200, true, 'Customer booking deleted successfully');
    } catch (error) {
        next(error);
    }
};

// @desc    Search customer by mobile or aadhaar
// @route   GET /api/customers/search
// @access  Private
exports.searchCustomer = async (req, res, next) => {
    try {
        const { mobile, aadhaar } = req.query;

        if (!mobile && !aadhaar) {
            return sendResponse(res, 400, false, 'Mobile number or Aadhaar number is required');
        }

        const query = {};
        if (mobile) query.mobile = mobile;
        if (aadhaar) query.aadhaar = formatAadhaar(aadhaar);

        const customer = await Customer.findOne({
            $or: Object.keys(query).map(key => ({ [key]: query[key] }))
        });

        if (!customer) {
            return sendResponse(res, 404, false, 'Customer not found');
        }

        // Get customer's booking history (last 2 years)
        const { startDate } = getTwoYearsDateRange();
        const bookings = await Booking.find({
            customer: customer._id,
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });

        // Get total historic data
        const customerSummary = await CustomerSummary.findOne({ customerId: customer._id });

        const customerData = {
            id: customer._id,
            name: customer.name,
            mobile: customer.mobile,
            aadhaar: customer.aadhaar,
            aadhaarImage: customer.aadhaarImage,
            totalVisits: customer.totalVisits + (customerSummary?.totalHistoricVisits || 0),
            totalRevenue: customer.totalRevenue + (customerSummary?.totalHistoricRevenue || 0),
            recentBookings: bookings.map(booking => ({
                id: booking._id,
                serialNo: booking.serialNo,
                entryNo: booking.entryNo,
                room: booking.room,
                rent: booking.rent,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                status: booking.status,
                totalAmount: booking.totalAmount
            }))
        };

        sendResponse(res, 200, true, 'Customer found', { customer: customerData });
    } catch (error) {
        next(error);
    }
};

// @desc    Get customer history
// @route   GET /api/customers/:id/history
// @access  Private
exports.getCustomerHistory = async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id).populate('customer');

        if (!booking) {
            return sendResponse(res, 404, false, 'Customer booking not found');
        }

        // Get all bookings for this customer (last 2 years)
        const { startDate } = getTwoYearsDateRange();
        const bookings = await Booking.find({
            customer: booking.customer._id,
            createdAt: { $gte: startDate }
        }).sort({ createdAt: -1 });

        // Get historic summary
        const customerSummary = await CustomerSummary.findOne({ customerId: booking.customer._id });

        const history = {
            customer: {
                name: booking.customer.name,
                mobile: booking.customer.mobile,
                aadhaar: booking.customer.aadhaar,
                totalVisits: booking.customer.totalVisits + (customerSummary?.totalHistoricVisits || 0),
                totalRevenue: booking.customer.totalRevenue + (customerSummary?.totalHistoricRevenue || 0)
            },
            recentBookings: bookings.map(b => ({
                id: b._id,
                serialNo: b.serialNo,
                entryNo: b.entryNo,
                room: b.room,
                rent: b.rent,
                checkIn: b.checkIn,
                checkOut: b.checkOut,
                status: b.status,
                totalAmount: b.totalAmount,
                createdAt: b.createdAt
            })),
            historicSummary: customerSummary ? {
                historicVisits: customerSummary.totalHistoricVisits,
                historicRevenue: customerSummary.totalHistoricRevenue,
                firstVisit: customerSummary.firstVisit,
                lastArchivedVisit: customerSummary.lastArchivedVisit
            } : null
        };

        sendResponse(res, 200, true, 'Customer history retrieved successfully', { history });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload Aadhaar image
// @route   POST /api/customers/:id/aadhaar-image
// @access  Private
exports.uploadAadhaarImage = async (req, res, next) => {
    try {
        if (!req.file) {
            return sendResponse(res, 400, false, 'Please upload an image file');
        }

        const booking = await Booking.findById(req.params.id).populate('customer');

        if (!booking) {
            return sendResponse(res, 404, false, 'Customer booking not found');
        }

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'hotel/aadhaar',
            public_id: `aadhaar_${booking.customer._id}`,
            overwrite: true
        });

        // Update customer record
        await Customer.findByIdAndUpdate(booking.customer._id, {
            aadhaarImage: result.secure_url
        });

        sendResponse(res, 200, true, 'Aadhaar image uploaded successfully', {
            imageUrl: result.secure_url
        });
    } catch (error) {
        next(error);
    }
};
