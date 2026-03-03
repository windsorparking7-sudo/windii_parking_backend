const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

// GET /api/public/session/:token - Get parking session by token (public endpoint for customers)
router.get('/session/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const sessions = await query(`
      SELECT 
        ps.id,
        ps.token,
        ps.vehicle_make,
        ps.vehicle_model,
        ps.vehicle_color,
        ps.license_plate,
        ps.parking_spot,
        ps.check_in_time,
        ps.status,
        ps.company_id,
        u.name as manager_name,
        u.phone as manager_phone,
        c.name as company_name
      FROM parking_sessions ps
      LEFT JOIN users u ON ps.manager_id = u.id
      LEFT JOIN companies c ON ps.company_id = c.id
      WHERE ps.token = ?
    `, [token]);

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parking session not found'
      });
    }

    res.json({
      success: true,
      data: sessions[0]
    });
  } catch (error) {
    console.error('Get session by token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch parking session'
    });
  }
});

// GET /api/public/car-request/:token - Get car request status by token (public endpoint)
router.get('/car-request/:token', async (req, res) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    const requests = await query(`
      SELECT 
        cr.id,
        cr.token,
        cr.status,
        cr.requested_at,
        cr.bringing_car_at,
        cr.car_arrived_at,
        cr.completed_at
      FROM car_requests cr
      WHERE cr.token = ?
      ORDER BY cr.id DESC
      LIMIT 1
    `, [token]);

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No car request found for this token'
      });
    }

    res.json({
      success: true,
      data: requests[0]
    });
  } catch (error) {
    console.error('Get car request by token error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car request'
    });
  }
});

// POST /api/public/car-request - Create car request (public endpoint for customers)
router.post('/car-request', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Get the parking session by token
    const sessions = await query(
      'SELECT id, company_id, manager_id FROM parking_sessions WHERE token = ?',
      [token]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Parking session not found'
      });
    }

    const session = sessions[0];

    // Check if there's already an active car request for this token
    const existingRequests = await query(
      "SELECT id FROM car_requests WHERE token = ? AND status NOT IN ('completed', 'cancelled')",
      [token]
    );

    if (existingRequests.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'A car request is already in progress for this token'
      });
    }

    // Create new car request
    const result = await query(`
      INSERT INTO car_requests (token, parking_session_id, company_id, manager_id, status, requested_at)
      VALUES (?, ?, ?, ?, 'requested', NOW())
    `, [token, session.id, session.company_id, session.manager_id]);

    res.status(201).json({
      success: true,
      message: 'Car request submitted successfully',
      data: {
        id: result.insertId,
        token: token,
        status: 'requested'
      }
    });
  } catch (error) {
    console.error('Create car request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create car request'
    });
  }
});

// GET /api/car-brands - Get all active car brands (public endpoint)
router.get('/car-brands', async (req, res) => {
  try {
    const { search } = req.query;
    
    let sql = `
      SELECT cb.*, 
             COUNT(cm.id) as models_count
      FROM car_brands cb
      LEFT JOIN car_models cm ON cb.id = cm.brand_id AND cm.is_active = TRUE
      WHERE cb.is_active = TRUE
    `;
    const params = [];

    if (search) {
      sql += ' AND cb.name LIKE ?';
      params.push(`%${search}%`);
    }

    sql += ' GROUP BY cb.id ORDER BY cb.name';

    const brands = await query(sql, params);

    res.json({
      success: true,
      data: brands
    });
  } catch (error) {
    console.error('Get car brands error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car brands'
    });
  }
});

// GET /api/car-models - Get all active car models (public endpoint)
router.get('/car-models', async (req, res) => {
  try {
    const { brand_id, search, body_type } = req.query;
    
    let sql = `
      SELECT cm.*, cb.name as brand_name
      FROM car_models cm
      JOIN car_brands cb ON cm.brand_id = cb.id
      WHERE cm.is_active = TRUE AND cb.is_active = TRUE
    `;
    const params = [];

    if (brand_id) {
      sql += ' AND cm.brand_id = ?';
      params.push(brand_id);
    }

    if (search) {
      sql += ' AND (cm.name LIKE ? OR cb.name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (body_type) {
      sql += ' AND cm.body_type = ?';
      params.push(body_type);
    }

    sql += ' ORDER BY cb.name, cm.name';

    const models = await query(sql, params);

    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    console.error('Get car models error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car models'
    });
  }
});

// GET /api/car-models/brand/:brand_id - Get models by brand (public endpoint)
router.get('/car-models/brand/:brand_id', async (req, res) => {
  try {
    const { brand_id } = req.params;

    // Verify brand exists and is active
    const brand = await query('SELECT id FROM car_brands WHERE id = ? AND is_active = TRUE', [brand_id]);
    if (brand.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Car brand not found'
      });
    }

    const models = await query(
      'SELECT * FROM car_models WHERE brand_id = ? AND is_active = TRUE ORDER BY name',
      [brand_id]
    );

    res.json({
      success: true,
      data: models
    });
  } catch (error) {
    console.error('Get models by brand error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch car models'
    });
  }
});

module.exports = router;
