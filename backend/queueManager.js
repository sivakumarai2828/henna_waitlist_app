import supabase from './supabaseClient.js';
import notificationService from './notificationService.js';

const MAX_CAPACITY = 30;

const getQueueState = async () => {
  const { data: waitingUsers, error: wErr } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true });

  const { data: activeArr, error: aErr } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'serving')
    .limit(1);

  const { data: settings } = await supabase
    .from('queue_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (wErr || aErr) console.error('getQueueState error', wErr || aErr);

  const avgMs = settings?.average_service_time_ms || 5 * 60 * 1000;
  const isPaused = settings?.is_paused || false;

  const queue = (waitingUsers || []).map((user, index) => ({
    ...user,
    position: index + 1,
    estimatedWaitTimeMs: avgMs * (index + 1)
  }));

  return {
    queue,
    activeUser: activeArr?.[0] || null,
    totalWaiting: queue.length,
    isPaused
  };
};

const joinQueue = async (name, email) => {
  // Duplicate check
  const { data: existing } = await supabase
    .from('queue_entries')
    .select('id')
    .eq('email', email)
    .in('status', ['waiting', 'serving'])
    .limit(1);

  if (existing && existing.length > 0) {
    throw new Error('This email is already in the queue.');
  }

  // Capacity check
  const { count } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'waiting');

  if (count >= MAX_CAPACITY) {
    throw new Error(`Queue is full. Maximum capacity is ${MAX_CAPACITY}.`);
  }

  const { data: newUser, error } = await supabase
    .from('queue_entries')
    .insert({ name, email, status: 'waiting', joined_at: new Date().toISOString() })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: settings } = await supabase
    .from('queue_settings')
    .select('average_service_time_ms')
    .eq('id', 1)
    .single();

  const avgMs = settings?.average_service_time_ms || 5 * 60 * 1000;
  const estimatedWaitTime = avgMs * ((count || 0) + 1);

  const position = (count || 0) + 1;
  notificationService.sendJoinedMessage(newUser, position);
  return { user: newUser, estimatedWaitTime };
};

const serveNext = async () => {
  const { data: settings } = await supabase
    .from('queue_settings')
    .select('*')
    .eq('id', 1)
    .single();

  if (settings?.is_paused) throw new Error('Queue is currently paused.');

  // Complete current serving user
  const { data: activeArr } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'serving')
    .limit(1);

  if (activeArr && activeArr.length > 0) {
    const activeUser = activeArr[0];
    const completedAt = new Date().toISOString();
    await supabase
      .from('queue_entries')
      .update({ status: 'completed', completed_at: completedAt })
      .eq('id', activeUser.id);

    // Update rolling average
    if (activeUser.started_at) {
      const actualMs = Date.now() - new Date(activeUser.started_at).getTime();
      await supabase.from('service_history').insert({ service_time_ms: actualMs });

      const { data: history } = await supabase
        .from('service_history')
        .select('service_time_ms')
        .order('served_at', { ascending: false })
        .limit(10);

      if (history && history.length > 0) {
        const avg = history.reduce((a, b) => a + b.service_time_ms, 0) / history.length;
        await supabase
          .from('queue_settings')
          .update({ average_service_time_ms: Math.max(2 * 60 * 1000, avg) })
          .eq('id', 1);
      }
    }
  }

  // Serve next waiting
  const { data: waitingUsers } = await supabase
    .from('queue_entries')
    .select('*')
    .eq('status', 'waiting')
    .order('joined_at', { ascending: true })
    .limit(3);

  if (!waitingUsers || waitingUsers.length === 0) return null;

  const nextUser = waitingUsers[0];
  await supabase
    .from('queue_entries')
    .update({ status: 'serving', started_at: new Date().toISOString() })
    .eq('id', nextUser.id);

  notificationService.sendTurnMessage(nextUser);

  // Notify whoever is now position 1 (next up after current)
  if (waitingUsers.length >= 2) {
    notificationService.sendAlmostTurnMessage(waitingUsers[1]);
  }

  return nextUser;
};

const skipUser = async (id) => {
  const { error } = await supabase
    .from('queue_entries')
    .update({ status: 'skipped', completed_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
};

const leaveQueue = async (id) => {
  const { error } = await supabase
    .from('queue_entries')
    .update({ status: 'left', completed_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['waiting']);

  if (error) throw new Error(error.message);
};

const togglePause = async () => {
  const { data: settings } = await supabase
    .from('queue_settings')
    .select('is_paused')
    .eq('id', 1)
    .single();

  const newState = !settings?.is_paused;
  await supabase.from('queue_settings').update({ is_paused: newState }).eq('id', 1);
  return newState;
};

const resetQueue = async () => {
  await supabase
    .from('queue_entries')
    .update({ status: 'reset' })
    .in('status', ['waiting', 'serving']);

  await supabase
    .from('queue_settings')
    .update({ is_paused: false, average_service_time_ms: 5 * 60 * 1000 })
    .eq('id', 1);
};

const getStats = async () => {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const { count: totalServed } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'completed')
    .gte('completed_at', today.toISOString());

  const { data: history } = await supabase
    .from('service_history')
    .select('service_time_ms')
    .order('served_at', { ascending: false })
    .limit(10);

  const avgMs = history && history.length > 0
    ? history.reduce((a, b) => a + b.service_time_ms, 0) / history.length
    : 5 * 60 * 1000;

  const { count: totalToday } = await supabase
    .from('queue_entries')
    .select('id', { count: 'exact', head: true })
    .gte('joined_at', today.toISOString());

  return {
    totalServedToday: totalServed || 0,
    totalJoinedToday: totalToday || 0,
    averageServiceMinutes: Math.round(avgMs / 60000)
  };
};

const resetStaleServing = async () => {
  // Reset any stuck 'serving' entries back to 'waiting'
  const { error: servingErr } = await supabase
    .from('queue_entries')
    .update({ status: 'waiting', started_at: null })
    .eq('status', 'serving');
  if (servingErr) console.error('resetStaleServing error', servingErr);

  // Clear all waiting entries from previous sessions
  const { error: waitingErr } = await supabase
    .from('queue_entries')
    .update({ status: 'reset' })
    .eq('status', 'waiting');
  if (waitingErr) console.error('clearStaleWaiting error', waitingErr);

  // Reset queue settings
  await supabase
    .from('queue_settings')
    .update({ is_paused: false, average_service_time_ms: 5 * 60 * 1000 })
    .eq('id', 1);

  console.log('Queue cleared on startup.');
};

const getEntryStatus = async (id) => {
  const { data } = await supabase
    .from('queue_entries')
    .select('id, status, name')
    .eq('id', id)
    .single();
  return data || null;
};

export default {
  getQueueState,
  joinQueue,
  serveNext,
  skipUser,
  leaveQueue,
  togglePause,
  resetQueue,
  resetStaleServing,
  getStats,
  getEntryStatus
};
