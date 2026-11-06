import { config } from '../config/env.js';

/**
 * Returns the current calendar date in the configured business timezone (Asia/Tashkent)
 * formatted as YYYY-MM-DD.
 *
 * @param {Date} [date=new Date()]
 * @param {string} [timeZone=config.BUSINESS_TIMEZONE]
 * @returns {string} Date formatted as 'YYYY-MM-DD'
 */
export function getBusinessDate(date = new Date(), timeZone = config.BUSINESS_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Returns formatted time in the configured business timezone (HH:mm:ss).
 *
 * @param {Date} [date=new Date()]
 * @param {string} [timeZone=config.BUSINESS_TIMEZONE]
 * @returns {string}
 */
export function getBusinessTime(date = new Date(), timeZone = config.BUSINESS_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  return formatter.format(date);
}

/**
 * Returns human-readable business datetime in Asia/Tashkent.
 *
 * @param {Date} [date=new Date()]
 * @param {string} [timeZone=config.BUSINESS_TIMEZONE]
 * @returns {string}
 */
export function getBusinessDateTimeString(date = new Date(), timeZone = config.BUSINESS_TIMEZONE) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  return formatter.format(date);
}

/**
 * Returns UTC ISO-8601 string for consistent timestamp persistence.
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 */
export function getUtcIsoString(date = new Date()) {
  return date.toISOString();
}

/**
 * Validates that a string is a valid calendar date in YYYY-MM-DD format.
 *
 * @param {string} dateString
 * @returns {boolean}
 */
export function isValidDateString(dateString) {
  if (typeof dateString !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false;

  const [yearStr, monthStr, dayStr] = dateString.split('-');
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  const day = Number.parseInt(dayStr, 10);

  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
