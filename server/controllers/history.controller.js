'use strict';

/** Historical observations (Open-Meteo past_days; DB-backed extension possible). */

const { ok } = require('../utils/envelope');
const historyService = require('../services/history.service');

async function getHistory(req, res, next) {
  try {
    const { range } = req.validatedQuery;
    const data = await historyService.getHistory(req.location, range);
    return ok(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getHistory };
