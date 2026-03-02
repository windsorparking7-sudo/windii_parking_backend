// Utility helper functions

/**
 * Generate a unique parking token
 * @returns {string} Token in format TK####
 */
const generateParkingToken = () => {
  return `TK${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
};

/**
 * Calculate parking duration in hours and minutes
 * @param {string|Date} entryTime - Entry timestamp
 * @param {string|Date} exitTime - Exit timestamp (defaults to now)
 * @returns {object} Duration object with hours, minutes, and total minutes
 */
const calculateDuration = (entryTime, exitTime = new Date()) => {
  const entry = new Date(entryTime);
  const exit = new Date(exitTime);
  const diffMs = exit.getTime() - entry.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return {
    hours,
    minutes,
    totalMinutes,
    formatted: `${hours}h ${minutes}m`
  };
};

/**
 * Calculate parking fee based on duration and rate
 * @param {number} hours - Number of hours parked
 * @param {number} ratePerHour - Rate per hour
 * @param {number} minimumCharge - Minimum charge
 * @returns {number} Total fee
 */
const calculateParkingFee = (hours, ratePerHour = 5, minimumCharge = 5) => {
  const calculatedFee = Math.ceil(hours) * ratePerHour;
  return Math.max(calculatedFee, minimumCharge);
};

/**
 * Format currency amount
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code
 * @returns {string} Formatted currency string
 */
const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency
  }).format(amount);
};

/**
 * Sanitize object by removing undefined/null values
 * @param {object} obj - Object to sanitize
 * @returns {object} Sanitized object
 */
const sanitizeObject = (obj) => {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v != null)
  );
};

/**
 * Generate random string for IDs
 * @param {number} length - Length of string
 * @returns {string} Random string
 */
const generateRandomString = (length = 8) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Parse pagination parameters
 * @param {object} query - Query parameters
 * @returns {object} Pagination object with page, limit, offset
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Build pagination response
 * @param {number} total - Total records
 * @param {number} page - Current page
 * @param {number} limit - Records per page
 * @returns {object} Pagination metadata
 */
const buildPaginationResponse = (total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1
  };
};

/**
 * Get date range for analytics
 * @param {string} period - Period type (today, week, month, year)
 * @returns {object} Start and end date strings
 */
const getDateRange = (period) => {
  const now = new Date();
  const end = now.toISOString().split('T')[0];
  let start;

  switch (period) {
    case 'today':
      start = end;
      break;
    case 'week':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'month':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    case 'year':
      start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  }

  return { start, end };
};

module.exports = {
  generateParkingToken,
  calculateDuration,
  calculateParkingFee,
  formatCurrency,
  sanitizeObject,
  generateRandomString,
  parsePagination,
  buildPaginationResponse,
  getDateRange
};
