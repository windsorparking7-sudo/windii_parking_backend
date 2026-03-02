require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { initializeSocket } = require('./socket');
const { connectDB } = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const companyRoutes = require('./routes/company');
const parkingRoutes = require('./routes/parking');
const managerRoutes = require('./routes/manager');
const statsRoutes = require('./routes/stats');
const carBrandsRoutes = require('./routes/car-brands');
const carModelsRoutes = require('./routes/car-models');
const publicCarDataRoutes = require('./routes/public-car-data');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initializeSocket(server);

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: [
    process.env.ADMIN_PANEL_URL || 'http://localhost:3000',
    process.env.COMPANY_PORTAL_URL || 'http://localhost:3001',
    process.env.COMPANY_PORTAL_URL_3 || 'http://localhost:3003',
    'https://musical-lokum-978ed2.netlify.app'
  ],
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/admin', carBrandsRoutes);
app.use('/api/admin', carModelsRoutes);
app.use('/api', publicCarDataRoutes);
app.use('/api/company', companyRoutes);
app.use('/api/parking', parkingRoutes);
app.use('/api/managers', managerRoutes);
app.use('/api/stats', statsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Windii Backend API is running',
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = process.env.PORT || 3000; // cPanel typically uses port 3000

// Start server immediately for Railway healthcheck
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                    WINDII PARKING BACKEND                   ║
╠════════════════════════════════════════════════════════════╣
║  Server running on port: ${PORT}                              ║
║  Environment: ${process.env.NODE_ENV || 'development'}                            ║
║  API Base URL: http://localhost:${PORT}/api                   ║
╚════════════════════════════════════════════════════════════╝
  `);
});

// Connect to database asynchronously
if (process.env.NODE_ENV === 'development' && process.env.SKIP_DB === 'true') {
  console.log('⚠️  Development mode: Skipping database connection');
} else {
  connectDB()
    .then(() => {
      console.log('✅ Database connected successfully');
    })
    .catch((err) => {
      console.error('❌ Failed to connect to database:', err);
      // Don't exit process - allow server to continue running for healthchecks
    });
}

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

module.exports = { app, server };
