'use strict';

/** Hourly (WeatherAPI bundle projection) and daily (Open-Meteo) forecasts. */

const { ok } = require('../utils/envelope');
const weatherService = require('../services/weather.service');

async function getHourly(req, res, next) {
  try {
    const { hours } = req.validatedQuery;
    const data = await weatherService.getHourly(req.location, hours);
    return ok(res, data);
  } catch (err) {
    return next(err);
  }
}

async function getDaily(req, res, next) {
  try {
    const { days } = req.validatedQuery;
    const data = await weatherService.getDaily(req.location, days);
    return ok(res, data);
  } catch (err) {
    return next(err);
  }
}

module.exports = { getHourly, getDaily };
