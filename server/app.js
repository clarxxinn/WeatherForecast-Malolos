'use strict';

/**
 * Express app assembly. Order matters:
 *   security headers → parsers → API (rate-limited) → static client → page routes
 *   → error handler. The CSP allowlists the Chart.js/Leaflet/Lucide CDNs and OSM
 *   tiles; without that, those resources are blocked and pages render blank.
 */

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cors = require('cors');

const { config } = require('./config');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const { apiLimiter } = require('./middleware/rateLimit');

const CLIENT_DIR = path.resolve(__dirname, '..', 'client');
const PAGES = ['forecast', 'alerts', 'map', 'history', 'about'];

function buildApp() {
  const app = express();

  // Behind a proxy/PaaS in prod so Secure cookies + rate-limit IPs work.
  if (config.isProd) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // --- Security headers (CSP tuned for our CDNs + OSM tiles) ---
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://unpkg.com'],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            'https://cdn.jsdelivr.net',
            'https://unpkg.com',
            'https://fonts.googleapis.com',
          ],
          imgSrc: [
            "'self'",
            'data:',
            'blob:',
            'https://*.tile.openstreetmap.org',
            'https://unpkg.com',
            'https://cdn.jsdelivr.net',
          ],
          connectSrc: ["'self'"],
          fontSrc: ["'self'", 'data:', 'https://cdn.jsdelivr.net', 'https://unpkg.com', 'https://fonts.gstatic.com'],
          workerSrc: ["'self'", 'blob:'],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
          // Removed so same-origin http (localhost/dev) fetches are not force-upgraded.
          upgradeInsecureRequests: null,
        },
      },
      // Allow cross-origin CDN/tile resources to load without COEP friction.
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(compression());

  // CORS only when explicit origins are configured; the SPA is same-origin by default.
  if (config.cors.origins.length) {
    app.use(cors({ origin: config.cors.origins, credentials: true }));
  }

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());

  // --- API ---
  app.use('/api', apiLimiter, apiRoutes);
  app.use('/api', notFound); // unknown /api/* → 404 JSON envelope

  // --- Static client assets ---
  app.use(
    express.static(CLIENT_DIR, {
      index: false, // we route '/' explicitly below
      etag: true,
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (config.isProd) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        } else {
          res.setHeader('Cache-Control', 'no-cache');
        }
      },
    })
  );

  // --- Clean page URLs (multi-page app) ---
  app.get('/', (req, res) => sendPage(res, 'index.html'));
  for (const page of PAGES) {
    app.get(`/${page}`, (req, res) => sendPage(res, `${page}.html`));
  }

  // Any other non-API GET for HTML falls back to the dashboard (resilient nav).
  app.get(/^\/(?!api\/).*/, (req, res, next) => {
    if (req.method === 'GET' && req.accepts('html')) return sendPage(res, 'index.html');
    return next();
  });

  app.use(errorHandler);
  return app;
}

function sendPage(res, file) {
  res.setHeader('Cache-Control', 'no-cache');
  res.sendFile(path.join(CLIENT_DIR, file));
}

module.exports = { buildApp };
