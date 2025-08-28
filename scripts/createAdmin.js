const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import models
const User = require('../models/User');

// Admin details variables
const adminUsername = 'shabbir';
const adminEmail = 'thetiptop007@gmail.com';
const adminPassword = 'tiptop2025';
const adminRole = 'admin';













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

        // Create admin user using variables
        const adminUser = await User.create({
            username: adminUsername,
            email: adminEmail,
            password: adminPassword,
            role: adminRole
        });

        console.log('Admin user created successfully:');
        console.log('Username:', adminUsername);
        console.log('Password:', adminPassword);
        console.log('Email:', adminEmail);
        console.log('Role:', adminRole);

        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error.message);
        process.exit(1);
    }
};

createAdminUser();
