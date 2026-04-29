import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.middleware';
import { config } from '../config';

const router = Router();

// ── In-memory cache (bodyPart → exercises, TTL 1 h) ──────────────────────────
interface CacheEntry { data: ExerciseApiItem[]; expiresAt: number }
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface ExerciseApiItem {
  id: string;
  name: string;
  bodyPart: string;
  target: string;
  equipment: string;
  gifUrl: string;
}

const VALID_BODY_PARTS = new Set([
  'back', 'cardio', 'chest', 'lower arms', 'lower legs',
  'neck', 'shoulders', 'upper arms', 'upper legs', 'waist',
]);

// ── GET /api/exercises/bodyPart/:bodyPart ─────────────────────────────────────
router.get('/bodyPart/:bodyPart', requireAuth, async (req: AuthRequest, res: Response) => {
  const bodyPart = (req.params['bodyPart'] as string)?.toLowerCase().trim();

  if (!VALID_BODY_PARTS.has(bodyPart)) {
    res.status(400).json({ error: `Invalid bodyPart. Valid values: ${[...VALID_BODY_PARTS].join(', ')}` });
    return;
  }

  if (!config.exerciseDbKey) {
    res.status(503).json({ error: 'ExerciseDB API key not configured.' });
    return;
  }

  // Serve from cache if still valid
  const cached = cache.get(bodyPart);
  if (cached && cached.expiresAt > Date.now()) {
    res.json({ exercises: cached.data, cached: true });
    return;
  }

  try {
    const url = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(bodyPart)}?limit=30&offset=0`;
    const response = await fetch(url, {
      headers: {
        'X-RapidAPI-Key':  config.exerciseDbKey,
        'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[exercises] ExerciseDB error:', response.status, text);
      res.status(502).json({ error: 'Failed to fetch from ExerciseDB.' });
      return;
    }

    const raw = await response.json() as ExerciseApiItem[];

    const exercises: ExerciseApiItem[] = raw.map(item => ({
      id:        item.id,
      name:      item.name,
      bodyPart:  item.bodyPart,
      target:    item.target,
      equipment: item.equipment,
      gifUrl:    item.gifUrl,
    }));

    cache.set(bodyPart, { data: exercises, expiresAt: Date.now() + CACHE_TTL_MS });
    res.json({ exercises, cached: false });
  } catch (err) {
    console.error('[exercises] fetch error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// ── GET /api/exercises/workoutType/:type ──────────────────────────────────────
// Convenience: returns exercises for push / pull / legs
router.get('/workoutType/:type', requireAuth, async (req: AuthRequest, res: Response) => {
  const type = (req.params['type'] as string)?.toLowerCase() as 'push' | 'pull' | 'legs';

  const bodyPartMap: Record<string, string[]> = {
    push: ['chest', 'shoulders', 'upper arms'],
    pull: ['back', 'upper arms'],
    legs: ['upper legs', 'lower legs'],
  };

  const parts = bodyPartMap[type];
  if (!parts) {
    res.status(400).json({ error: 'type must be push, pull or legs.' });
    return;
  }

  if (!config.exerciseDbKey) {
    res.status(503).json({ error: 'ExerciseDB API key not configured.' });
    return;
  }

  try {
    const results = await Promise.all(parts.map(async (part) => {
      const cached = cache.get(part);
      if (cached && cached.expiresAt > Date.now()) return cached.data;

      const url = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${encodeURIComponent(part)}?limit=30&offset=0`;
      const response = await fetch(url, {
        headers: {
          'X-RapidAPI-Key':  config.exerciseDbKey,
          'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
        },
      });

      if (!response.ok) return [];
      const raw = await response.json() as ExerciseApiItem[];
      const exercises = raw.map(item => ({
        id: item.id, name: item.name, bodyPart: item.bodyPart,
        target: item.target, equipment: item.equipment, gifUrl: item.gifUrl,
      }));
      cache.set(part, { data: exercises, expiresAt: Date.now() + CACHE_TTL_MS });
      return exercises;
    }));

    // Interleave and return up to 8 exercises
    const merged: ExerciseApiItem[] = [];
    const maxPerPart = Math.ceil(8 / parts.length);
    for (const list of results) merged.push(...list.slice(0, maxPerPart));

    res.json({ exercises: merged.slice(0, 8), workoutType: type });
  } catch (err) {
    console.error('[exercises] workoutType error:', err);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
