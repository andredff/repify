import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';

import healthRouter         from './routes/health.route';
import checkinRouter        from './routes/checkin.route';
import profileRouter        from './routes/profile.route';
import postsRouter          from './routes/posts.route';
import usersRouter          from './routes/users.route';
import notificationsRouter  from './routes/notifications.route';

const app = express();

// ── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      'img-src': ["'self'", 'data:', 'https://*.supabase.co'],
    },
  },
}));

const allowedOrigins = [
  'http://localhost:4200',
  'http://localhost:4201',
  ...(process.env['CORS_ORIGINS']?.split(',').map(o => o.trim()).filter(Boolean) ?? []),
];

app.use(cors({
  origin: (origin, cb) => {
    // Permite requests sem Origin (curl, mobile webviews) e qualquer origem na whitelist
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS blocked: ${origin}`));
  },
}));
app.use(express.json({ limit: '1mb' }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/health',              healthRouter);
app.use('/api/checkin',         checkinRouter);
app.use('/api/profile',         profileRouter);
app.use('/api/posts',           postsRouter);
app.use('/api/users',           usersRouter);
app.use('/api/notifications',   notificationsRouter);

// ── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`[repify-server] running on http://localhost:${config.port}`);
});

export default app;
