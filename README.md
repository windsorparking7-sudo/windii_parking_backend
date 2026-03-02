# Windii Parking Backend

Backend API server for **Windii Parking** system, serving both the Admin Panel and Company Portal applications.

## Tech Stack

- **Node.js** with **Express.js** - REST API server
- **MySQL** - Database (phpMyAdmin compatible)
- **Socket.io** - Real-time WebSocket connections
- **JWT** - Authentication
- **bcryptjs** - Password hashing

## Project Structure

```
windii-backend/
├── src/
│   ├── config/
│   │   └── database.js       # MySQL connection pool
│   ├── database/
│   │   ├── migrate.js        # Database migrations
│   │   └── seed.js           # Seed data
│   ├── middleware/
│   │   ├── auth.js           # JWT authentication
│   │   └── validators.js     # Request validation
│   ├── routes/
│   │   ├── admin.js          # Admin Panel APIs
│   │   ├── auth.js           # Authentication APIs
│   │   ├── company.js        # Company Portal APIs
│   │   ├── manager.js        # Manager management APIs
│   │   ├── parking.js        # Parking session APIs
│   │   └── stats.js          # Analytics & statistics APIs
│   ├── socket/
│   │   └── index.js          # Socket.io configuration
│   └── server.js             # Entry point
├── .env.example              # Environment variables template
├── .gitignore
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- MySQL 8.0+ (or MariaDB)
- phpMyAdmin (optional, for database management)

### Installation

1. **Clone/Navigate to the backend directory:**
   ```bash
   cd /Volumes/NewVolume/windii-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=windii_parking
   JWT_SECRET=your_super_secret_key
   ```

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

5. **Seed sample data (optional):**
   ```bash
   npm run seed
   ```

6. **Start the server:**
   ```bash
   # Development (with auto-reload)
   npm run dev
   
   # Production
   npm start
   ```

The server will start at `http://localhost:5000`

## API Endpoints

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/admin/login` | Super admin login (Admin Panel) |
| POST | `/api/auth/company/login` | Company user login (Company Portal) |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/change-password` | Change password |
| POST | `/api/auth/logout` | Logout |

### Admin Panel APIs (`/api/admin`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/companies` | List all companies |
| GET | `/companies/:id` | Get company details |
| POST | `/companies` | Register new company |
| PUT | `/companies/:id` | Update company |
| POST | `/companies/:id/grant-access` | Grant portal access |
| POST | `/companies/:id/revoke-access` | Revoke portal access |
| GET | `/companies/:id/managers` | Get company managers |
| GET | `/companies/:id/live-parking` | Get live parking |
| GET | `/companies/:id/parking-history` | Get parking history |
| GET | `/dashboard` | Get dashboard stats |

### Company Portal APIs (`/api/company`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/profile` | Get company profile |
| PUT | `/profile` | Update company profile |
| GET | `/dashboard` | Get dashboard stats |
| GET | `/manager-performance` | Get manager performance |
| GET | `/rates` | Get parking rates |
| PUT | `/rates` | Update parking rates |
| GET | `/locations` | Get all locations |

### Parking APIs (`/api/parking`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List parking sessions |
| GET | `/live` | Get live parking sessions |
| GET | `/sessions/:id` | Get session by ID |
| GET | `/token/:token` | Get session by token (public) |
| POST | `/sessions` | Create parking session |
| POST | `/sessions/:id/close` | Close parking session |
| PUT | `/sessions/:id` | Update session |
| GET | `/history` | Get parking history |
| GET | `/requests` | Get car requests |
| POST | `/requests` | Create car request |
| POST | `/requests/:id/complete` | Complete car request |

### Manager APIs (`/api/managers`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | List all managers |
| GET | `/:id` | Get manager details |
| POST | `/` | Create manager |
| PUT | `/:id` | Update manager |
| PATCH | `/:id/status` | Update manager status |
| POST | `/:id/reset-password` | Reset manager password |
| GET | `/:id/sessions` | Get manager's sessions |

### Statistics APIs (`/api/stats`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/revenue` | Revenue analytics |
| GET | `/revenue/by-manager` | Revenue by manager |
| GET | `/revenue/by-location` | Revenue by location |
| GET | `/vehicles` | Vehicle type statistics |
| GET | `/hourly` | Hourly distribution |
| GET | `/daily-comparison` | Today vs yesterday |
| GET | `/peak-hours` | Peak hours analysis |
| GET | `/export` | Export report data |

## WebSocket Events

### Client → Server

| Event | Description |
|-------|-------------|
| `join-company` | Join company room for updates |
| `join-admin` | Join admin room |
| `join-manager` | Join manager-specific room |
| `car-request` | Emit car request notification |
| `parking-update` | Emit parking update |

### Server → Client

| Event | Description |
|-------|-------------|
| `parking-session-added` | New parking session created |
| `parking-session-closed` | Parking session closed |
| `new-car-request` | New car retrieval request |
| `car-request-completed` | Car request completed |
| `company-added` | New company registered |
| `company-updated` | Company updated |
| `company-access-granted` | Company access granted |

## Default Login Credentials

After running `npm run seed`:

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@windii.com | admin123 |
| Company Admin (ParkEasy) | john.smith@parkeasy.com | admin123 |
| Company Manager (ParkEasy) | sarah.johnson@parkeasy.com | manager123 |

## Database Schema

### Tables

- **super_admins** - System administrators
- **companies** - Parking companies
- **company_users** - Company admins and managers
- **parking_sessions** - Parking records
- **car_requests** - Customer car retrieval requests
- **revenue_records** - Revenue tracking
- **parking_rates** - Company parking rates
- **activity_logs** - User activity logging

## Frontend Integration

### Admin Panel (parking-admin-panel)

Update API calls to use:
```javascript
const API_URL = 'http://localhost:5000/api';

// Login
const response = await fetch(`${API_URL}/auth/admin/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// Authenticated requests
const response = await fetch(`${API_URL}/admin/companies`, {
  headers: { 
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### Company Portal (parking-company-portal)

```javascript
const API_URL = 'http://localhost:5000/api';

// Login
const response = await fetch(`${API_URL}/auth/company/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password })
});

// WebSocket connection
import { io } from 'socket.io-client';
const socket = io('http://localhost:5000');
socket.emit('join-company', companyId);
socket.on('parking-session-added', (data) => {
  // Handle new session
});
```

## Scripts

```bash
npm start       # Start production server
npm run dev     # Start development server with nodemon
npm run migrate # Run database migrations
npm run seed    # Seed sample data
npm run setup   # Run migrate + seed
```

## License

MIT
