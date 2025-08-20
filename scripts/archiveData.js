const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const CustomerSummary = require('../models/CustomerSummary');
require('dotenv').config();

// Archive old data (older than 2 years) but keep summary
const archiveOldData = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const twoYearsAgo = new Date();
        twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);

        console.log(`Archiving data older than: ${twoYearsAgo.toISOString()}`);

        // Find old bookings
        const oldBookings = await Booking.find({
            createdAt: { $lt: twoYearsAgo }
        }).populate('customer');

        if (oldBookings.length === 0) {
            console.log('No old bookings found to archive');
            return;
        }

        console.log(`Found ${oldBookings.length} old bookings to archive`);

        // Group bookings by customer
        const customerBookings = {};
        oldBookings.forEach(booking => {
            const customerId = booking.customer._id.toString();
            if (!customerBookings[customerId]) {
                customerBookings[customerId] = {
                    customer: booking.customer,
                    bookings: []
                };
            }
            customerBookings[customerId].bookings.push(booking);
        });

        // Create or update customer summaries
        for (const [customerId, data] of Object.entries(customerBookings)) {
            const { customer, bookings } = data;

            const totalHistoricVisits = bookings.length;
            const totalHistoricRevenue = bookings.reduce((sum, booking) => sum + booking.totalAmount, 0);
            const firstVisit = bookings.reduce((earliest, booking) =>
                booking.createdAt < earliest ? booking.createdAt : earliest, bookings[0].createdAt);
            const lastArchivedVisit = bookings.reduce((latest, booking) =>
                booking.createdAt > latest ? booking.createdAt : latest, bookings[0].createdAt);

            // Check if summary already exists
            const existingSummary = await CustomerSummary.findOne({ customerId });

            if (existingSummary) {
                // Update existing summary
                existingSummary.totalHistoricVisits += totalHistoricVisits;
                existingSummary.totalHistoricRevenue += totalHistoricRevenue;
                if (!existingSummary.firstVisit || firstVisit < existingSummary.firstVisit) {
                    existingSummary.firstVisit = firstVisit;
                }
                existingSummary.lastArchivedVisit = lastArchivedVisit;
                existingSummary.archivedAt = new Date();
                await existingSummary.save();
            } else {
                // Create new summary
                await CustomerSummary.create({
                    customerId,
                    name: customer.name,
                    mobile: customer.mobile,
                    aadhaar: customer.aadhaar,
                    totalHistoricVisits,
                    totalHistoricRevenue,
                    firstVisit,
                    lastArchivedVisit
                });
            }

            // Update customer record to subtract archived data
            customer.totalVisits = Math.max(0, customer.totalVisits - totalHistoricVisits);
            customer.totalRevenue = Math.max(0, customer.totalRevenue - totalHistoricRevenue);
            await customer.save();

            console.log(`Archived ${totalHistoricVisits} visits for customer: ${customer.name}`);
        }

        // Delete old bookings
        const deleteResult = await Booking.deleteMany({
            createdAt: { $lt: twoYearsAgo }
        });

        console.log(`Deleted ${deleteResult.deletedCount} old bookings`);

        // Clean up customers with no recent visits
        const customersToCheck = await Customer.find({ totalVisits: 0 });
        for (const customer of customersToCheck) {
            const recentBookings = await Booking.countDocuments({ customer: customer._id });
            if (recentBookings === 0) {
                await Customer.findByIdAndDelete(customer._id);
                console.log(`Deleted inactive customer: ${customer.name}`);
            }
        }

        console.log('Archive process completed successfully');
    } catch (error) {
        console.error('Archive process failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

// Run the archive process
if (require.main === module) {
    archiveOldData();
}

module.exports = archiveOldData;
