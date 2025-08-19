# TipTop Hotel Management System - Backend

A comprehensive backend API for hotel management system built with Node.js, Express, and MongoDB.

## Features

- **User Authentication & Authorization** (JWT based)
- **Customer Management** with history tracking
- **Booking Management** with status tracking
- **Analytics & Reporting** dashboard
- **File Upload** for Aadhaar documents (Cloudinary)
- **Data Archiving** (maintains totals while archiving old records)
- **Role-based Access Control** (Admin, Manager, Staff)

## Tech Stack

- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Cloudinary** - Image storage
- **Multer** - File upload handling

## Installation

1. **Clone the repository**
   ```bash
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Copy `.env` file and update the following variables:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/tiptop_hotel
   JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
   JWT_EXPIRE=30d
   CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
   CLOUDINARY_API_KEY=your_cloudinary_api_key
   CLOUDINARY_API_SECRET=your_cloudinary_api_secret
   FRONTEND_URL=http://localhost:5173
   ```

4. **MongoDB Setup**
   - Install MongoDB Compass
   - Create a database named `tiptop_hotel`
   - Update `MONGODB_URI` in `.env` file

5. **Cloudinary Setup** (Optional - for image uploads)
   - Create account at [Cloudinary](https://cloudinary.com/)
   - Get your cloud name, API key, and API secret
   - Update Cloudinary variables in `.env`

## Running the Application

1. **Development Mode**
   ```bash
   npm run dev
   ```

2. **Production Mode**
   ```bash
   npm start
   ```

3. **Seed Database** (Optional)
   ```bash
   node scripts/seedData.js
   ```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### Customers
- `GET /api/customers` - Get all customers with pagination
- `POST /api/customers` - Create new customer & booking
- `GET /api/customers/:id` - Get single customer
- `PUT /api/customers/:id` - Update customer
- `DELETE /api/customers/:id` - Delete customer booking
- `GET /api/customers/search` - Search customer by mobile/aadhaar
- `GET /api/customers/:id/history` - Get customer history
- `POST /api/customers/:id/aadhaar-image` - Upload Aadhaar image

### Analytics
- `GET /api/analytics/dashboard` - Dashboard statistics
- `GET /api/analytics/revenue` - Revenue analytics
- `GET /api/analytics/customers` - Customer analytics
- `GET /api/analytics/occupancy` - Occupancy analytics
- `GET /api/analytics/export` - Export data (Admin/Manager only)

### Health Check
- `GET /api/health` - Server health status

## Database Models

### User
- username, email, password, role, isActive, lastLogin

### Customer
- name, mobile, aadhaar, aadhaarImage, totalVisits, totalRevenue

### Booking
- serialNo, entryNo, customer (ref), room, rent, checkIn, checkOut, status, totalAmount

### CustomerSummary
- Stores aggregate data for archived customers (maintains totals)

## Data Management

### Archiving System
The system maintains a 2-year rolling window of detailed records while preserving total counts:

1. **Recent Data** (Last 2 years): Full booking details available
2. **Historic Data** (Older than 2 years): Archived to `CustomerSummary` collection
3. **Total Counts**: Always show complete totals (recent + historic)

### Running Archive Process
```bash
node scripts/archiveData.js
```

## Security Features

- **Password Hashing** with bcryptjs
- **JWT Authentication** with secure tokens
- **Rate Limiting** to prevent abuse
- **CORS Protection** 
- **Helmet** for security headers
- **Input Validation** with express-validator
- **Role-based Authorization**

## File Upload

- **Multer** for handling multipart/form-data
- **Cloudinary** for storing images
- **File Type Validation** (images only)
- **File Size Limits** (5MB max)

## Default Users (After Seeding)

- **Admin**: Username: `admin`, Password: `admin123`
- **Manager**: Username: `manager`, Password: `manager123`

## Error Handling

Comprehensive error handling with:
- Custom error middleware
- Validation error formatting
- MongoDB error handling
- JWT error handling
- 404 error handling

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `node scripts/seedData.js` - Seed database with sample data
- `node scripts/archiveData.js` - Archive old data (>2 years)

## API Response Format

```json
{
  "success": true,
  "message": "Success message",
  "data": {
    // Response data
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Node environment | `development` |
| `PORT` | Server port | `5000` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/tiptop_hotel` |
| `JWT_SECRET` | JWT secret key | `your_secret_key` |
| `JWT_EXPIRE` | JWT expiration time | `30d` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | `your_api_secret` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:5173` |

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the ISC License.
