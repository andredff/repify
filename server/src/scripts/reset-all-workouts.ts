import 'dotenv/config';
import { supabaseAdmin } from '../supabase';

type UserMetadata = Record<string, unknown>;

interface AuthUserSummary {
  id: string;
  user_metadata?: UserMetadata;
}

interface XpEventRow {
  xp: number;
  created_at: string;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function weekStartString(): string {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - now.getDay());
  return isoDate(now);
}

function countStreak(dates: string[]): number {
  const uniqueDates = new Set(dates);
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < 365; i++) {
    const key = isoDate(cursor);
    if (!uniqueDates.has(key)) {
      if (i === 0) {
        return 0;
      }
      break;
    }

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function listAllUsers(): Promise<AuthUserSummary[]> {
  const users: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data.users.map(user => ({
      id: user.id,
      user_metadata: (user.user_metadata ?? user.raw_user_meta_data ?? {}) as UserMetadata,
    }));

    users.push(...batch);

    if (batch.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

async function main(): Promise<void> {
  const weekStart = weekStartString();
  const nowIso = new Date().toISOString();
  const [historyBefore, daySessionsBefore, programsBefore] = await Promise.all([
    supabaseAdmin.from('workout_history').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('workout_day_sessions').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('workout_programs').select('*', { count: 'exact', head: true }),
  ]);

  const [{ count: workoutEventsBefore, error: beforeError }, usersResult] = await Promise.all([
    supabaseAdmin.from('xp_events').select('*', { count: 'exact', head: true }).eq('type', 'workout'),
    listAllUsers(),
  ]);

  if (beforeError) throw beforeError;

  const users = usersResult;

  const { error: deleteError } = await supabaseAdmin.from('xp_events').delete().eq('type', 'workout');
  if (deleteError) throw deleteError;

  const { error: deleteHistoryError } = await supabaseAdmin.from('workout_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (deleteHistoryError) throw deleteHistoryError;

  const { error: deleteDaySessionsError } = await supabaseAdmin.from('workout_day_sessions').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  if (deleteDaySessionsError) throw deleteDaySessionsError;

  const { error: deleteProgramsError } = await supabaseAdmin.from('workout_programs').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
  if (deleteProgramsError) throw deleteProgramsError;

  let processed = 0;
  for (const user of users) {
    const { data: remainingEvents, error: remainingError } = await supabaseAdmin
      .from('xp_events')
      .select('xp,created_at')
      .eq('user_id', user.id);

    if (remainingError) throw remainingError;

    const events = (remainingEvents ?? []) as XpEventRow[];
    const totalXp = events.reduce((sum, event) => sum + Number(event.xp ?? 0), 0);
    const weeklyXp = events.reduce((sum, event) => {
      return event.created_at.slice(0, 10) >= weekStart ? sum + Number(event.xp ?? 0) : sum;
    }, 0);
    const streakDays = countStreak(events.map(event => event.created_at.slice(0, 10)));
    const { error: upsertError } = await supabaseAdmin.from('user_stats').upsert({
      user_id: user.id,
      total_xp: totalXp,
      weekly_xp: weeklyXp,
      streak_days: streakDays,
      week_start: weekStart,
      updated_at: nowIso,
    }, { onConflict: 'user_id' });

    if (upsertError) throw upsertError;

    const metadata = { ...(user.user_metadata ?? {}), workouts_done: 0 };
    const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: metadata,
    });

    if (updateUserError) throw updateUserError;
    processed += 1;
  }

  const [{ count: workoutEventsAfter, error: afterError }, verificationStats] = await Promise.all([
    supabaseAdmin.from('xp_events').select('*', { count: 'exact', head: true }).eq('type', 'workout'),
    supabaseAdmin.from('user_stats').select('user_id,total_xp,weekly_xp,streak_days').limit(5),
  ]);

  if (afterError) throw afterError;
  if (verificationStats.error) throw verificationStats.error;

  console.log(JSON.stringify({
    ok: true,
    usersProcessed: processed,
    workoutEventsBefore: workoutEventsBefore ?? 0,
    workoutEventsAfter: workoutEventsAfter ?? 0,
    workoutHistoryBefore: historyBefore.count ?? 0,
    workoutDaySessionsBefore: daySessionsBefore.count ?? 0,
    workoutProgramsBefore: programsBefore.count ?? 0,
    sampleUserStats: verificationStats.data ?? [],
  }, null, 2));
}

main().catch(error => {
  console.error('[reset-all-workouts] failed', error);
  process.exit(1);
});
