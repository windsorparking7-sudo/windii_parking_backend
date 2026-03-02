const express = require('express');
const { query } = require('../config/database');
const { authenticate, isCompanyAdmin, belongsToCompany } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get company profile
router.get('/profile', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const companies = await query('SELECT * FROM companies WHERE id = ?', [companyId]);
    
    if (companies.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Company not found'
      });
    }

    res.json({
      success: true,
      data: companies[0]
    });
  } catch (error) {
    console.error('Get company profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch company profile'
    });
  }
});

// Update company profile (admin only)
router.put('/profile', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { name, address, contact } = req.body;

    await query(
      'UPDATE companies SET name = COALESCE(?, name), address = COALESCE(?, address), contact = COALESCE(?, contact) WHERE id = ?',
      [name, address, contact, companyId]
    );

    const updatedCompany = await query('SELECT * FROM companies WHERE id = ?', [companyId]);

    res.json({
      success: true,
      message: 'Company profile updated',
      data: updatedCompany[0]
    });
  } catch (error) {
    console.error('Update company profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update company profile'
    });
  }
});

// Get company dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let whereClause = 'WHERE ps.company_id = ?';
    let params = [companyId];

    // Managers only see their own stats
    if (!isAdmin) {
      whereClause += ' AND ps.manager_id = ?';
      params.push(userId);
    }

    // Total revenue
    const [totalRevenue] = await query(
      `SELECT SUM(total_fee) as total FROM parking_sessions ps ${whereClause} AND ps.status = 'closed'`,
      params
    );

    // Open tickets
    const [openTickets] = await query(
      `SELECT COUNT(*) as count FROM parking_sessions ps ${whereClause} AND ps.status = 'open'`,
      params
    );

    // Total cars parked
    const [totalCars] = await query(
      `SELECT COUNT(*) as count FROM parking_sessions ps ${whereClause}`,
      params
    );

    // Today's stats
    const today = new Date().toISOString().split('T')[0];
    const [todayCars] = await query(
      `SELECT COUNT(*) as count FROM parking_sessions ps ${whereClause} AND DATE(ps.entry_time) = ?`,
      [...params, today]
    );

    const [todayRevenue] = await query(
      `SELECT SUM(total_fee) as total FROM parking_sessions ps ${whereClause} AND ps.status = 'closed' AND DATE(ps.exit_time) = ?`,
      [...params, today]
    );

    res.json({
      success: true,
      data: {
        totalRevenue: totalRevenue?.total || 0,
        openTickets: openTickets?.count || 0,
        totalCarsParked: totalCars?.count || 0,
        carsParkedToday: todayCars?.count || 0,
        todayRevenue: todayRevenue?.total || 0,
        personalRevenue: !isAdmin ? (totalRevenue?.total || 0) : null
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// Get manager performance (admin only)
router.get('/manager-performance', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const performance = await query(
      `SELECT 
        cu.id as manager_id,
        cu.name as manager_name,
        cu.location,
        COUNT(ps.id) as cars_parked,
        COALESCE(SUM(CASE WHEN ps.status = 'closed' THEN ps.total_fee ELSE 0 END), 0) as total_revenue
       FROM company_users cu
       LEFT JOIN parking_sessions ps ON cu.id = ps.manager_id AND DATE(ps.entry_time) = ?
       WHERE cu.company_id = ? AND cu.role = 'manager' AND cu.status = 'active'
       GROUP BY cu.id, cu.name, cu.location
       ORDER BY total_revenue DESC`,
      [targetDate, companyId]
    );

    res.json({
      success: true,
      data: performance.map(p => ({
        managerId: p.manager_id,
        managerName: p.manager_name,
        location: p.location,
        carsParked: p.cars_parked || 0,
        totalRevenue: p.total_revenue || 0,
        date: targetDate
      }))
    });
  } catch (error) {
    console.error('Get manager performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch manager performance'
    });
  }
});

// Get parking rates
router.get('/rates', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const rates = await query(
      'SELECT * FROM parking_rates WHERE company_id = ?',
      [companyId]
    );

    res.json({
      success: true,
      data: rates
    });
  } catch (error) {
    console.error('Get rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parking rates'
    });
  }
});

// Update parking rates (admin only)
router.put('/rates', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { rates } = req.body;

    if (!Array.isArray(rates)) {
      return res.status(400).json({
        success: false,
        message: 'Rates must be an array'
      });
    }

    for (const rate of rates) {
      await query(
        `INSERT INTO parking_rates (company_id, vehicle_type, rate_per_hour, minimum_charge, overnight_rate) 
         VALUES (?, ?, ?, ?, ?) 
         ON DUPLICATE KEY UPDATE rate_per_hour = ?, minimum_charge = ?, overnight_rate = ?`,
        [
          companyId, 
          rate.vehicleType, 
          rate.ratePerHour, 
          rate.minimumCharge || 5, 
          rate.overnightRate,
          rate.ratePerHour,
          rate.minimumCharge || 5,
          rate.overnightRate
        ]
      );
    }

    const updatedRates = await query(
      'SELECT * FROM parking_rates WHERE company_id = ?',
      [companyId]
    );

    res.json({
      success: true,
      message: 'Parking rates updated',
      data: updatedRates
    });
  } catch (error) {
    console.error('Update rates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update parking rates'
    });
  }
});

// Get all locations in company
router.get('/locations', async (req, res) => {
  try {
    const companyId = req.user.company_id;

    const locations = await query(
      'SELECT DISTINCT location FROM company_users WHERE company_id = ? AND location IS NOT NULL AND location != ""',
      [companyId]
    );

    res.json({
      success: true,
      data: locations.map(l => l.location)
    });
  } catch (error) {
    console.error('Get locations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch locations'
    });
  }
});

module.exports = router;
