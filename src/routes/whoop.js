import express from 'express';
import axios from 'axios';
 
const router = express.Router();
 
const whoopGet = (token, path) =>
  axios.get(`https://api.prod.whoop.com/developer/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
 
// GET /api/whoop/today — everything we need for the daily dashboard
router.get('/today', async (req, res) => {
  const token = req.user.access_token;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
 
  try {
    const [recoveryRes, sleepRes, cycleRes] = await Promise.allSettled([
      whoopGet(token, `/recovery?start=${yesterday}T00:00:00.000Z&end=${today}T23:59:59.000Z`),
      whoopGet(token, `/activity/sleep?start=${yesterday}T00:00:00.000Z&end=${today}T23:59:59.000Z`),
      whoopGet(token, `/cycle?start=${today}T00:00:00.000Z&end=${today}T23:59:59.000Z`),
    ]);
 
    const recovery = recoveryRes.status === 'fulfilled'
      ? recoveryRes.value.data?.records?.[0] : null;
    const sleep = sleepRes.status === 'fulfilled'
      ? sleepRes.value.data?.records?.[0] : null;
    const cycle = cycleRes.status === 'fulfilled'
      ? cycleRes.value.data?.records?.[0] : null;
 
    const recoveryScore = recovery?.score?.recovery_score ?? null;
    const hrv = recovery?.score?.hrv_rmssd_milli ?? null;
    const restingHR = recovery?.score?.resting_heart_rate_bpm ?? null;
    const sleepPerf = sleep?.score?.sleep_performance_percentage ?? null;
    const caloriesBurned = cycle?.score?.kilojoule
      ? Math.round(cycle.score.kilojoule / 4.184)
      : null;
    const strain = cycle?.score?.strain ?? null;
 
    // Workout recommendation based on recovery
    let workoutRec = 'full';
    let workoutNote = 'Recovery is solid — full session, push your weights.';
    if (recoveryScore !== null) {
      if (recoveryScore < 34) {
        workoutRec = 'rest';
        workoutNote = 'Low recovery — just do the 20-min incline walk today. Protect the body.';
      } else if (recoveryScore < 67) {
        workoutRec = 'reduced';
        workoutNote = 'Moderate recovery — do the full session but drop one working set per exercise.';
      }
    }
 
    res.json({
      recoveryScore,
      hrv,
      restingHR,
      sleepPerf,
      caloriesBurned,
      strain,
      workoutRec,
      workoutNote,
    });
  } catch (err) {
    console.error('Whoop today error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Whoop data' });
  }
});
 
// GET /api/whoop/history?days=30 — trend data for charts
router.get('/history', async (req, res) => {
  const token = req.user.access_token;
  const days = parseInt(req.query.days) || 30;
  const end = new Date().toISOString();
  const start = new Date(Date.now() - days * 86400000).toISOString();
 
  try {
    const [recoveryRes, cycleRes] = await Promise.allSettled([
      whoopGet(token, `/recovery?start=${start}&end=${end}&limit=${days}`),
      whoopGet(token, `/cycle?start=${start}&end=${end}&limit=${days}`),
    ]);
 
    const records = recoveryRes.status === 'fulfilled'
      ? recoveryRes.value.data?.records || [] : [];
    const cycles = cycleRes.status === 'fulfilled'
      ? cycleRes.value.data?.records || [] : [];
 
    const history = records.map(r => ({
      date: r.created_at?.split('T')[0],
      recovery: r.score?.recovery_score,
      hrv: r.score?.hrv_rmssd_milli,
      restingHR: r.score?.resting_heart_rate_bpm,
    }));
 
    const calorieHistory = cycles.map(c => ({
      date: c.created_at?.split('T')[0],
      calories: c.score?.kilojoule ? Math.round(c.score.kilojoule / 4.184) : null,
      strain: c.score?.strain,
    }));
 
    res.json({ history, calorieHistory });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});
 
export default router;
