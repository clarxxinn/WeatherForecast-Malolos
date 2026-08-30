'use strict';

/** User preferences (auth required). Get/update the single per-user prefs row. */

const { ok } = require('../utils/envelope');
const preferencesModel = require('../models/preferences.model');

async function getPreferences(req, res, next) {
  try {
    const prefs = await preferencesModel.getByUserId(req.user.id);
    return ok(res, { preferences: prefs });
  } catch (err) {
    return next(err);
  }
}

async function updatePreferences(req, res, next) {
  try {
    // Merge onto current so a partial update doesn't clobber unspecified fields.
    const current = await preferencesModel.getByUserId(req.user.id);
    const merged = { ...current, ...req.body };
    const prefs = await preferencesModel.upsert(req.user.id, merged);
    return ok(res, { preferences: prefs });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getPreferences, updatePreferences };
