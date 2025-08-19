const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Booking = require('../models/Booking');
require('dotenv').config();

const seedData = async () => {
    try {
        // Connect to database
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Customer.deleteMany({});
        await Booking.deleteMany({});
        console.log('Cleared existing data');

        // Create admin user
        const adminUser = await User.create({
            username: 'admin',
            email: 'admin@tiptophotel.com',
            password: 'admin123',
            role: 'admin'
        });

        // Create manager user
        const managerUser = await User.create({
            username: 'manager',
            email: 'manager@tiptophotel.com',
            password: 'manager123',
            role: 'manager'
        });

        console.log('Created admin and manager users');

        // Sample customers data
        const customersData = [
            {
                name: 'John Smith',
                mobile: '9876543210',
                aadhaar: '1234-5678-9012',
                aadhaarImage: 'https://images.unsplash.com/photo-1586953208448-b95a79798f07?w=400&auto=format&fit=crop&q=60'
            },
            {
                name: 'Sarah Johnson',
                mobile: '8765432109',
                aadhaar: '9876-5432-1098',
                aadhaarImage: 'https://images.unsplash.com/photo-1569467030863-50bcb7ab50b7?w=400&auto=format&fit=crop&q=60'
            },
            {
                name: 'Mike Wilson',
                mobile: '7654321098',
                aadhaar: '8765-4321-0987',
                aadhaarImage: 'https://images.unsplash.com/photo-1589578228447-e1a4e481c6c8?w=400&auto=format&fit=crop&q=60'
            },
            {
                name: 'Emily Davis',
                mobile: '6543210987',
                aadhaar: '7654-3210-9876',
                aadhaarImage: 'https://images.unsplash.com/photo-1609013732375-7c1a0e11b1b6?w=400&auto=format&fit=crop&q=60'
            },
            {
                name: 'David Brown',
                mobile: '5432109876',
                aadhaar: '6543-2109-8765',
                aadhaarImage: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=400&auto=format&fit=crop&q=60'
            }
        ];

        // Create customers
        const customers = [];
        for (let customerData of customersData) {
            const customer = await Customer.create({
                ...customerData,
                totalVisits: Math.floor(Math.random() * 5) + 1,
                totalRevenue: Math.floor(Math.random() * 10000) + 2000
            });
            customers.push(customer);
        }

        console.log('Created sample customers');

        // Sample bookings data
        const bookingsData = [
            {
                room: '201',
                rent: 2500,
                checkIn: new Date('2024-08-15'),
                checkOut: new Date('2024-08-20'),
                status: 'checked-in'
            },
            {
                room: '401',
                rent: 3200,
                checkIn: new Date('2024-08-14'),
                checkOut: new Date('2024-08-18'),
                status: 'checked-out'
            },
            {
                room: '102',
                rent: 2800,
                checkIn: new Date('2024-08-16'),
                checkOut: new Date('2024-08-21'),
                status: 'checked-in'
            },
            {
                room: '301',
                rent: 3500,
                checkIn: new Date('2024-08-10'),
                checkOut: new Date('2024-08-15'),
                status: 'checked-out'
            },
            {
                room: '203',
                rent: 2900,
                checkIn: new Date('2024-08-17'),
                checkOut: new Date('2024-08-22'),
                status: 'checked-in'
            }
        ];

        // Create bookings
        for (let i = 0; i < bookingsData.length; i++) {
            const customer = customers[i];
            const bookingData = bookingsData[i];

            const serialNo = `S${Date.now()}${String(i).padStart(3, '0')}`;
            const entryNo = `E${Date.now()}${String(i).padStart(3, '0')}`;

            await Booking.create({
                serialNo,
                entryNo,
                customer: customer._id,
                customerName: customer.name,
                customerMobile: customer.mobile,
                customerAadhaar: customer.aadhaar,
                ...bookingData,
                createdBy: adminUser._id
            });
        }

        console.log('Created sample bookings');
        console.log('Seed data created successfully!');
        console.log('\nDefault login credentials:');
        console.log('Admin - Username: admin, Password: admin123');
        console.log('Manager - Username: manager, Password: manager123');

    } catch (error) {
        console.error('Seed process failed:', error);
    } finally {
        await mongoose.disconnect();
    }
};

// Run the seed process
if (require.main === module) {
    seedData();
}

module.exports = seedData;
