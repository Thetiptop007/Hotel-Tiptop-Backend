const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');

// Connect to MongoDB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
};

const createAdminUser = async () => {
    try {
        await connectDB();

        // Check if admin user already exists
        const existingAdmin = await User.findOne({ role: 'admin' });

        if (existingAdmin) {
            console.log('Admin user already exists:', existingAdmin.username);
            process.exit(0);
        }

        // Create admin user
        const adminUser = await User.create({
            username: 'admin',
            email: 'admin@tiptophotel.com',
            password: 'admin123',
            role: 'admin'
        });

        console.log('Admin user created successfully:');
        console.log('Username: admin');
        console.log('Password: admin123');
        console.log('Email: admin@tiptophotel.com');
        console.log('Role: admin');

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error.message);
        process.exit(1);
    }
};

createAdminUser();
