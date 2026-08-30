'use strict';

/**
 * Zod request schemas. Query schemas use coercion so `?hours=24` (a string)
 * validates as a number. `.default()` fills omitted optionals. These are the
 * single source of truth for what each endpoint accepts.
 */

const { z } = require('zod');

const locationField = z.string().trim().min(1).max(40).optional();

const locationQuery = z.object({
  location: locationField,
});

const hourlyQuery = z.object({
  location: locationField,
  hours: z.coerce.number().int().min(1).max(48).default(24),
});

const dailyQuery = z.object({
  location: locationField,
  days: z.coerce.number().int().min(1).max(16).default(7),
});

const historyQuery = z.object({
  location: locationField,
  range: z.enum(['24h', '7d', '30d']).default('24h'),
});

const registerBody = z.object({
  name: z.string().trim().min(1, 'Name is required.').max(80),
  email: z.string().trim().toLowerCase().email('A valid email is required.').max(160),
  password: z.string().min(8, 'Password must be at least 8 characters.').max(200),
});

const loginBody = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required.').max(160),
  password: z.string().min(1, 'Password is required.').max(200),
});

const preferencesBody = z
  .object({
    temperatureUnit: z.enum(['c', 'f']).optional(),
    notificationsEnabled: z.boolean().optional(),
    defaultLocationId: z.number().int().positive().nullable().optional(),
    theme: z.enum(['light', 'dark']).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'No preferences provided.' });

module.exports = {
  locationQuery,
  hourlyQuery,
  dailyQuery,
  historyQuery,
  registerBody,
  loginBody,
  preferencesBody,
};
