// utils/timezoneHelper.js
// Pakistan Timezone Helper (PKT = UTC+5)

const moment = require('moment-timezone');

// Set default timezone to Pakistan
const TIMEZONE = 'Asia/Karachi';

/**
 * Get current date in Pakistan timezone (start of day)
 */
const getTodayPKT = () => {
  return moment.tz(TIMEZONE).startOf('day').toDate();
};

/**
 * Get current date/time in Pakistan timezone
 */
const getNowPKT = () => {
  return moment.tz(TIMEZONE).toDate();
};

/**
 * Convert any date to Pakistan timezone (start of day)
 */
const toStartOfDayPKT = (date) => {
  return moment.tz(date, TIMEZONE).startOf('day').toDate();
};

/**
 * Parse date string in Pakistan timezone
 */
const parseDatePKT = (dateString) => {
  return moment.tz(dateString, TIMEZONE).toDate();
};

/**
 * Get date range for a specific day in PKT
 * Returns { start, end } for querying database
 */
const getDayRangePKT = (dateString) => {
  const start = moment.tz(dateString, TIMEZONE).startOf('day');
  const end = moment.tz(dateString, TIMEZONE).endOf('day');
  
  return {
    start: start.toDate(),
    end: end.toDate()
  };
};

/**
 * Format date for display in PKT
 */
const formatDatePKT = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  return moment.tz(date, TIMEZONE).format(format);
};

/**
 * Check if a time is late (after 9:00 AM PKT)
 */
const isLate = (checkInTime) => {
  const checkIn = moment.tz(checkInTime, TIMEZONE);
  const nineAM = moment.tz(TIMEZONE).startOf('day').add(9, 'hours');
  return checkIn.isAfter(nineAM);
};

module.exports = {
  TIMEZONE,
  getTodayPKT,
  getNowPKT,
  toStartOfDayPKT,
  parseDatePKT,
  getDayRangePKT,
  formatDatePKT,
  isLate
};