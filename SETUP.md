# Windii Parking - Complete Setup Guide

## Prerequisites

- **Node.js** 18+ 
- **MySQL** 8.0+ (or MariaDB)
- **phpMyAdmin** (optional, for database management)
- **Git**

## Backend Setup

### 1. Navigate to Backend Directory
```bash
cd /Volumes/NewVolume/windii-backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Database
1. Start MySQL server
2. Create database (or let migration script create it):
   ```sql
   CREATE DATABASE windii_parking;
   ```

### 4. Environment Configuration
The `.env` file is already configured. Update if needed:
```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=windii_parking
JWT_SECRET=windii_parking_super_secret_jwt_key_2024
```

### 5. Run Database Migration & Seeding
```bash
# Create all tables
npm run migrate

# Seed sample data
npm run seed
```

### 6. Start Backend Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Backend will run on: **http://localhost:5000**

## Frontend Setup

### Admin Panel Setup

1. **Navigate to Admin Panel**
   ```bash
   cd /Volumes/NewVolume/parking-admin-panel
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Install Additional Dependencies for API Integration**
   ```bash
   npm install axios socket.io-client
   ```

4. **Start Admin Panel**
   ```bash
   npm start
   ```
   
   Admin Panel will run on: **http://localhost:3000**

### Company Portal Setup

1. **Navigate to Company Portal**
   ```bash
   cd /Volumes/NewVolume/parking-company-portal
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Install Additional Dependencies for API Integration**
   ```bash
   npm install axios socket.io-client @types/node
   ```

4. **Start Company Portal**
   ```bash
   npm start
   ```
   
   Company Portal will run on: **http://localhost:3001**

## Testing the Integration

### 1. Test Backend Health
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "Windii Backend API is running",
  "timestamp": "2024-..."
}
```

### 2. Test Admin Panel Login
1. Go to: http://localhost:3000
2. Login with:
   - **Email**: admin@windii.com
   - **Password**: admin123

### 3. Test Company Portal Login
1. Go to: http://localhost:3001
2. Login with:
   - **Email**: john.smith@parkeasy.com (Company Admin)
   - **Password**: admin123
   
   OR
   
   - **Email**: sarah.johnson@parkeasy.com (Manager)
   - **Password**: manager123

## API Endpoints Testing

### Authentication Endpoints
```bash
# Admin Login
curl -X POST http://localhost:5000/api/auth/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@windii.com","password":"admin123"}'

# Company Login  
curl -X POST http://localhost:5000/api/auth/company/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john.smith@parkeasy.com","password":"admin123"}'
```

### Admin Panel Endpoints
```bash
# Get Dashboard (requires admin token)
curl -X GET http://localhost:5000/api/admin/dashboard \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Get Companies
curl -X GET http://localhost:5000/api/admin/companies \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Company Portal Endpoints
```bash
# Get Company Dashboard (requires company token)
curl -X GET http://localhost:5000/api/company/dashboard \
  -H "Authorization: Bearer YOUR_COMPANY_TOKEN"

# Get Live Parking Sessions
curl -X GET http://localhost:5000/api/parking/live \
  -H "Authorization: Bearer YOUR_COMPANY_TOKEN"
```

## Database Schema

The following tables are created:

- **super_admins** - System administrators
- **companies** - Parking companies
- **company_users** - Company admins and managers  
- **parking_sessions** - Parking records
- **car_requests** - Customer car retrieval requests
- **revenue_records** - Revenue tracking
- **parking_rates** - Company parking rates
- **activity_logs** - User activity logging

## Real-time Features

The system includes Socket.io for real-time updates:

- **Live parking session updates**
- **Car request notifications**
- **Revenue updates**
- **Manager performance tracking**

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check MySQL is running
   - Verify credentials in `.env`
   - Ensure database exists

2. **Port Already in Use**
   - Backend (5000): `lsof -ti:5000 | xargs kill -9`
   - Admin Panel (3000): `lsof -ti:3000 | xargs kill -9`
   - Company Portal (3001): `lsof -ti:3001 | xargs kill -9`

3. **CORS Issues**
   - Ensure frontend URLs are correct in backend CORS config
   - Check `.env` files have correct API URLs

4. **TypeScript Errors in Company Portal**
   - Install missing dependencies: `npm install @types/react @types/react-dom`
   - The errors are mainly due to transition from mock data to API calls

### Reset Database
```bash
cd /Volumes/NewVolume/windii-backend
npm run migrate
npm run seed
```

## Production Deployment

For production deployment:

1. **Backend**: Deploy to server with MySQL database
2. **Admin Panel**: Build and deploy to static hosting
3. **Company Portal**: Build and deploy to static hosting
4. **Environment**: Update API URLs in production `.env` files

## Support

- Backend API Documentation: Check `README.md` in windii-backend
- Database Schema: See migration files in `src/database/`
- API Testing: Use Postman collection (can be created from endpoint documentation)
