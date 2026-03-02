const express = require('express');
const { query } = require('../config/database');
const { authenticate, isCompanyAdmin } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all routes
router.use(authenticate);

// Get revenue analytics (admin only)
router.get('/revenue', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    // Default to last 30 days if no dates provided
    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let dateFormat;
    switch (groupBy) {
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'week':
        dateFormat = '%Y-%u';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }

    const revenueData = await query(
      `SELECT 
        DATE_FORMAT(exit_time, ?) as period,
        COUNT(*) as total_sessions,
        SUM(total_fee) as total_revenue,
        AVG(total_fee) as avg_fee
       FROM parking_sessions 
       WHERE company_id = ? 
         AND status = 'closed' 
         AND DATE(exit_time) BETWEEN ? AND ?
       GROUP BY period
       ORDER BY period ASC`,
      [dateFormat, companyId, start, end]
    );

    // Get totals
    const [totals] = await query(
      `SELECT 
        COUNT(*) as total_sessions,
        SUM(total_fee) as total_revenue,
        AVG(total_fee) as avg_fee
       FROM parking_sessions 
       WHERE company_id = ? 
         AND status = 'closed' 
         AND DATE(exit_time) BETWEEN ? AND ?`,
      [companyId, start, end]
    );

    res.json({
      success: true,
      data: {
        chartData: revenueData,
        summary: {
          totalSessions: totals?.total_sessions || 0,
          totalRevenue: totals?.total_revenue || 0,
          avgFee: totals?.avg_fee || 0,
          period: { start, end }
        }
      }
    });
  } catch (error) {
    console.error('Get revenue analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue analytics'
    });
  }
});

// Get revenue by manager (admin only)
router.get('/revenue/by-manager', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const managerRevenue = await query(
      `SELECT 
        cu.id as manager_id,
        cu.name as manager_name,
        cu.location,
        COUNT(ps.id) as total_sessions,
        COALESCE(SUM(ps.total_fee), 0) as total_revenue
       FROM company_users cu
       LEFT JOIN parking_sessions ps ON cu.id = ps.manager_id 
         AND ps.status = 'closed' 
         AND DATE(ps.exit_time) BETWEEN ? AND ?
       WHERE cu.company_id = ? AND cu.role = 'manager'
       GROUP BY cu.id, cu.name, cu.location
       ORDER BY total_revenue DESC`,
      [start, end, companyId]
    );

    res.json({
      success: true,
      data: managerRevenue
    });
  } catch (error) {
    console.error('Get manager revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch manager revenue'
    });
  }
});

// Get revenue by location (admin only)
router.get('/revenue/by-location', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const locationRevenue = await query(
      `SELECT 
        COALESCE(cu.location, 'Unassigned') as location,
        COUNT(ps.id) as total_sessions,
        COALESCE(SUM(ps.total_fee), 0) as total_revenue
       FROM parking_sessions ps
       LEFT JOIN company_users cu ON ps.manager_id = cu.id
       WHERE ps.company_id = ? 
         AND ps.status = 'closed' 
         AND DATE(ps.exit_time) BETWEEN ? AND ?
       GROUP BY cu.location
       ORDER BY total_revenue DESC`,
      [companyId, start, end]
    );

    res.json({
      success: true,
      data: locationRevenue
    });
  } catch (error) {
    console.error('Get location revenue error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch location revenue'
    });
  }
});

// Get vehicle type statistics
router.get('/vehicles', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (!isAdmin) {
      whereClause += ' AND manager_id = ?';
      params.push(userId);
    }

    const vehicleStats = await query(
      `SELECT 
        vehicle_type,
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) as open_count,
        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_count,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN total_fee ELSE 0 END), 0) as total_revenue
       FROM parking_sessions 
       ${whereClause}
       GROUP BY vehicle_type`,
      params
    );

    res.json({
      success: true,
      data: vehicleStats
    });
  } catch (error) {
    console.error('Get vehicle stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle statistics'
    });
  }
});

// Get hourly distribution
router.get('/hourly', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const hourlyStats = await query(
      `SELECT 
        HOUR(entry_time) as hour,
        COUNT(*) as entries
       FROM parking_sessions 
       WHERE company_id = ? AND DATE(entry_time) = ?
       GROUP BY HOUR(entry_time)
       ORDER BY hour`,
      [companyId, targetDate]
    );

    // Fill in missing hours with 0
    const fullHourlyStats = [];
    for (let i = 0; i < 24; i++) {
      const found = hourlyStats.find(h => h.hour === i);
      fullHourlyStats.push({
        hour: i,
        entries: found ? found.entries : 0
      });
    }

    res.json({
      success: true,
      data: fullHourlyStats
    });
  } catch (error) {
    console.error('Get hourly stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch hourly statistics'
    });
  }
});

// Get daily comparison (today vs yesterday)
router.get('/daily-comparison', async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let whereClause = 'WHERE company_id = ?';
    const params = [companyId];

    if (!isAdmin) {
      whereClause += ' AND manager_id = ?';
      params.push(userId);
    }

    // Today's stats
    const [todayStats] = await query(
      `SELECT 
        COUNT(*) as sessions,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN total_fee ELSE 0 END), 0) as revenue
       FROM parking_sessions 
       ${whereClause} AND DATE(entry_time) = ?`,
      [...params, today]
    );

    // Yesterday's stats
    const [yesterdayStats] = await query(
      `SELECT 
        COUNT(*) as sessions,
        COALESCE(SUM(CASE WHEN status = 'closed' THEN total_fee ELSE 0 END), 0) as revenue
       FROM parking_sessions 
       ${whereClause} AND DATE(entry_time) = ?`,
      [...params, yesterday]
    );

    // Calculate percentage change
    const sessionChange = yesterdayStats?.sessions 
      ? ((todayStats?.sessions - yesterdayStats.sessions) / yesterdayStats.sessions * 100).toFixed(1)
      : 0;
    const revenueChange = yesterdayStats?.revenue 
      ? ((todayStats?.revenue - yesterdayStats.revenue) / yesterdayStats.revenue * 100).toFixed(1)
      : 0;

    res.json({
      success: true,
      data: {
        today: {
          sessions: todayStats?.sessions || 0,
          revenue: todayStats?.revenue || 0
        },
        yesterday: {
          sessions: yesterdayStats?.sessions || 0,
          revenue: yesterdayStats?.revenue || 0
        },
        change: {
          sessions: parseFloat(sessionChange),
          revenue: parseFloat(revenueChange)
        }
      }
    });
  } catch (error) {
    console.error('Get daily comparison error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily comparison'
    });
  }
});

// Get peak hours analysis (admin only)
router.get('/peak-hours', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { days = 30 } = req.query;

    const peakHours = await query(
      `SELECT 
        HOUR(entry_time) as hour,
        DAYNAME(entry_time) as day_name,
        COUNT(*) as entries
       FROM parking_sessions 
       WHERE company_id = ? 
         AND entry_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY HOUR(entry_time), DAYNAME(entry_time)
       ORDER BY entries DESC
       LIMIT 10`,
      [companyId, parseInt(days)]
    );

    res.json({
      success: true,
      data: peakHours
    });
  } catch (error) {
    console.error('Get peak hours error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch peak hours'
    });
  }
});

// Export report data
router.get('/export', isCompanyAdmin, async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { startDate, endDate, type = 'sessions' } = req.query;

    const end = endDate || new Date().toISOString().split('T')[0];
    const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let data;

    if (type === 'sessions') {
      data = await query(
        `SELECT 
          ps.token,
          ps.plate_number,
          ps.vehicle_model,
          ps.vehicle_color,
          ps.vehicle_type,
          ps.customer_name,
          ps.customer_phone,
          ps.spot,
          ps.entry_time,
          ps.exit_time,
          ps.total_fee,
          ps.status,
          cu.name as manager_name
         FROM parking_sessions ps
         LEFT JOIN company_users cu ON ps.manager_id = cu.id
         WHERE ps.company_id = ? 
           AND DATE(ps.entry_time) BETWEEN ? AND ?
         ORDER BY ps.entry_time DESC`,
        [companyId, start, end]
      );
    } else if (type === 'revenue') {
      data = await query(
        `SELECT 
          DATE(exit_time) as date,
          COUNT(*) as sessions,
          SUM(total_fee) as revenue
         FROM parking_sessions 
         WHERE company_id = ? 
           AND status = 'closed'
           AND DATE(exit_time) BETWEEN ? AND ?
         GROUP BY DATE(exit_time)
         ORDER BY date DESC`,
        [companyId, start, end]
      );
    }

    res.json({
      success: true,
      data: {
        type,
        period: { start, end },
        records: data
      }
    });
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report'
    });
  }
});

module.exports = router;
