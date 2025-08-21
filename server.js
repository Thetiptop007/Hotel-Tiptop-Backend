const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const bookingRoutes = require('./routes/bookings');
const analyticsRoutes = require('./routes/analytics');
const uploadRoutes = require('./routes/upload');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { notFound } = require('./middleware/notFound');

const app = express();

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.MAX_REQUESTS_PER_WINDOW) || 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/analytics', analyticsRoutes);

// Root endpoint for health check
app.get('/', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Hotel Tiptop API Server',
        version: '1.0.0',
        endpoints: {
            health: '/api/health',
            auth: '/api/auth',
            bookings: '/api/bookings',
            analytics: '/api/analytics'
        },
        timestamp: new Date().toISOString(),
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Database connection
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error('Database connection failed:', error.message);
        process.exit(1);
    }
};

// Start server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
    await connectDB();

    const server = app.listen(PORT, () => {
        console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`);
    });

    // Keep-alive mechanism to prevent Render from sleeping
    if (process.env.NODE_ENV === 'production') {
        const keepAlive = () => {
            const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

            setInterval(async () => {
                try {
                    const https = require('https');
                    const http = require('http');
                    const client = url.startsWith('https') ? https : http;

                    client.get(`${url}/api/health`, (res) => {
                        console.log(`Keep-alive ping: ${res.statusCode}`);
                    }).on('error', (err) => {
                        console.log('Keep-alive ping failed:', err.message);
                    });
                } catch (error) {
                    console.log('Keep-alive error:', error.message);
                }
            }, 14 * 60 * 1000); // Ping every 14 minutes (Render sleeps after 15 minutes)
        };

        // Start keep-alive after 2 minutes
        setTimeout(keepAlive, 2 * 60 * 1000);
        console.log('Keep-alive service started for production environment');
    }

    return server;
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`Error: ${err.message}`);
    // Note: server variable is not available here, process will exit
    process.exit(1);
});

// Start server and store reference
let serverInstance;
startServer().then(server => {
    serverInstance = server;
}).catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});

module.exports = app;
