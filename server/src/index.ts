import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';

import healthRouter  from './routes/health.route';
import checkinRouter from './routes/checkin.route';
import profileRouter from './routes/profile.route';
import postsRouter   from './routes/posts.route';
import usersRouter   from './routes/users.route';

const app = express();

// ── Security & parsing ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: ['http://localhost:4200', 'http://localhost:4201'] }));
app.use(express.json({ limit: '1mb' }));

// ── Routes ──────────────────────────────────────────────────────────────────
app.use('/health',       healthRouter);
app.use('/api/checkin',  checkinRouter);
app.use('/api/profile',  profileRouter);
app.use('/api/posts',    postsRouter);
app.use('/api/users',    usersRouter);

// ── 404 fallback ────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(config.port, () => {
  console.log(`[repify-server] running on http://localhost:${config.port}`);
});

export default app;
