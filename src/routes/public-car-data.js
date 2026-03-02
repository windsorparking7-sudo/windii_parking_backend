const express = require('express');
const { query } = require('../config/database');

const router = express.Router();

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
