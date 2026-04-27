"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const supabase_1 = require("../supabase");
async function listAllUsers() {
    const users = [];
    let page = 1;
    const perPage = 200;
    while (true) {
        const { data, error } = await supabase_1.supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (error)
            throw error;
        const batch = data.users.map(user => ({
            id: user.id,
            user_metadata: (user.user_metadata ?? user.raw_user_meta_data ?? {}),
        }));
        users.push(...batch);
        if (batch.length < perPage)
            break;
        page += 1;
    }
    return users;
}
async function countRows(table) {
    const { count, error } = await supabase_1.supabaseAdmin.from(table).select('*', { count: 'exact', head: true });
    if (error) {
        if (error.code === '42P01') {
            return { count: 0 };
        }
        throw error;
    }
    return { count: count ?? 0 };
}
async function tableExists(table) {
    const { error } = await supabase_1.supabaseAdmin.from(table).select('*', { head: true, count: 'exact' }).limit(1);
    if (!error)
        return true;
    if (error.code === '42P01')
        return false;
    throw error;
}
async function userStatsHasWalkKm() {
    const { error } = await supabase_1.supabaseAdmin.from('user_stats').select('total_walk_km').limit(1);
    if (!error)
        return true;
    if (error.code === '42703')
        return false;
    if (error.code === '42P01')
        return false;
    throw error;
}
async function main() {
    const nowIso = new Date().toISOString();
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartIso = weekStart.toISOString().slice(0, 10);
    const [users, xpEventsBefore, checkinsTablePresent, walkKmPresent] = await Promise.all([
        listAllUsers(),
        countRows('xp_events'),
        tableExists('checkins'),
        userStatsHasWalkKm(),
    ]);
    const checkinsBefore = checkinsTablePresent ? await countRows('checkins') : { count: 0 };
    const [workoutHistoryBefore, workoutDaySessionsBefore, workoutProgramsBefore] = await Promise.all([
        countRows('workout_history'),
        countRows('workout_day_sessions'),
        countRows('workout_programs'),
    ]);
    const { error: deleteXpError } = await supabase_1.supabaseAdmin.from('xp_events').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteXpError)
        throw deleteXpError;
    if (checkinsTablePresent) {
        const { error: deleteCheckinsError } = await supabase_1.supabaseAdmin.from('checkins').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (deleteCheckinsError)
            throw deleteCheckinsError;
    }
    const { error: deleteWorkoutHistoryError } = await supabase_1.supabaseAdmin.from('workout_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteWorkoutHistoryError)
        throw deleteWorkoutHistoryError;
    const { error: deleteWorkoutDaySessionsError } = await supabase_1.supabaseAdmin.from('workout_day_sessions').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    if (deleteWorkoutDaySessionsError)
        throw deleteWorkoutDaySessionsError;
    const { error: deleteWorkoutProgramsError } = await supabase_1.supabaseAdmin.from('workout_programs').delete().neq('user_id', '00000000-0000-0000-0000-000000000000');
    if (deleteWorkoutProgramsError)
        throw deleteWorkoutProgramsError;
    const { data: userStatRows, error: statsReadError } = await supabase_1.supabaseAdmin.from('user_stats').select('user_id');
    if (statsReadError && statsReadError.code !== '42P01')
        throw statsReadError;
    const existingStatUserIds = new Set((userStatRows ?? []).map(row => row.user_id));
    for (const user of users) {
        const payload = {
            user_id: user.id,
            total_xp: 0,
            weekly_xp: 0,
            streak_days: 0,
            week_start: weekStartIso,
            updated_at: nowIso,
        };
        if (walkKmPresent) {
            payload['total_walk_km'] = 0;
        }
        if (existingStatUserIds.has(user.id)) {
            const { error: updateError } = await supabase_1.supabaseAdmin.from('user_stats').update(payload).eq('user_id', user.id);
            if (updateError)
                throw updateError;
        }
        else {
            const { error: insertError } = await supabase_1.supabaseAdmin.from('user_stats').insert(payload);
            if (insertError)
                throw insertError;
        }
        const metadata = { ...(user.user_metadata ?? {}), workouts_done: 0 };
        const { error: userUpdateError } = await supabase_1.supabaseAdmin.auth.admin.updateUserById(user.id, {
            user_metadata: metadata,
        });
        if (userUpdateError)
            throw userUpdateError;
    }
    const [xpEventsAfter, checkinsAfter, sampleStats] = await Promise.all([
        countRows('xp_events'),
        checkinsTablePresent ? countRows('checkins') : Promise.resolve({ count: 0 }),
        walkKmPresent
            ? supabase_1.supabaseAdmin.from('user_stats').select('user_id,total_xp,weekly_xp,streak_days,total_walk_km').limit(5)
            : supabase_1.supabaseAdmin.from('user_stats').select('user_id,total_xp,weekly_xp,streak_days').limit(5),
    ]);
    if (sampleStats.error)
        throw sampleStats.error;
    console.log(JSON.stringify({
        ok: true,
        usersProcessed: users.length,
        xpEventsBefore: xpEventsBefore.count,
        xpEventsAfter: xpEventsAfter.count,
        checkinsBefore: checkinsBefore.count,
        checkinsAfter: checkinsAfter.count,
        workoutHistoryBefore: workoutHistoryBefore.count,
        workoutDaySessionsBefore: workoutDaySessionsBefore.count,
        workoutProgramsBefore: workoutProgramsBefore.count,
        walkKmReset: walkKmPresent,
        sampleUserStats: sampleStats.data ?? [],
    }, null, 2));
}
main().catch(error => {
    console.error('[reset-all-progress] failed', error);
    process.exit(1);
});
