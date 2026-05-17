import express from 'express';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
 
const router = express.Router();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
 
// POST /api/logs/food — log calories eaten
router.post('/food', async (req, res) => {
  const { calories, meal, date } = req.body;
  const { error } = await supabase.from('food_logs').insert({
    whoop_user_id: req.user.whoop_user_id,
    calories: parseInt(calories),
    meal,
    date: date || new Date().toISOString().split('T')[0],
  });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
 
// GET /api/logs/food?date=YYYY-MM-DD — get food logs for a day
router.get('/food', async (req, res) => {
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('food_logs')
    .select('*')
    .eq('whoop_user_id', req.user.whoop_user_id)
    .eq('date', date)
    .order('created_at');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
 
// POST /api/logs/body — log weight and waist
router.post('/body', async (req, res) => {
  const { weight, waist, date } = req.body;
  const { error } = await supabase.from('body_logs').upsert({
    whoop_user_id: req.user.whoop_user_id,
    weight_lbs: parseFloat(weight),
    waist_inches: parseFloat(waist),
    date: date || new Date().toISOString().split('T')[0],
    updated_at: new Date().toISOString(),
  }, { onConflict: 'whoop_user_id,date' });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ success: true });
});
 
// GET /api/logs/body — get all body logs for trend chart
router.get('/body', async (req, res) => {
  const { data, error } = await supabase
    .from('body_logs')
    .select('*')
    .eq('whoop_user_id', req.user.whoop_user_id)
    .order('date');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});
 
// GET /api/logs/summary — full dashboard summary for today
router.get('/summary', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const userId = req.user.whoop_user_id;
 
  const [foodRes, bodyRes] = await Promise.all([
    supabase.from('food_logs').select('calories').eq('whoop_user_id', userId).eq('date', today),
    supabase.from('body_logs').select('*').eq('whoop_user_id', userId).order('date', { ascending: false }).limit(7),
  ]);
 
  const caloriesIn = (foodRes.data || []).reduce((sum, r) => sum + r.calories, 0);
  const bodyLogs = bodyRes.data || [];
  const latest = bodyLogs[0] || null;
 
  // Waist trend — rate of change per week
  let waistTrend = null;
  if (bodyLogs.length >= 2) {
    const oldest = bodyLogs[bodyLogs.length - 1];
    const newest = bodyLogs[0];
    const daysDiff = (new Date(newest.date) - new Date(oldest.date)) / 86400000;
    if (daysDiff > 0) {
      const change = newest.waist_inches - oldest.waist_inches;
      waistTrend = (change / daysDiff) * 7; // change per week
    }
  }
 
  // Days until waist hits 36.5" at current rate
  let daysToGoal = null;
  if (latest?.waist_inches && waistTrend && waistTrend < 0) {
    const remaining = latest.waist_inches - 36.5;
    daysToGoal = Math.ceil(remaining / Math.abs(waistTrend) * 7);
  }
 
  res.json({
    caloriesIn,
    currentWeight: latest?.weight_lbs,
    currentWaist: latest?.waist_inches,
    waistGoal: 36.5,
    waistTrendPerWeek: waistTrend ? Math.round(waistTrend * 100) / 100 : null,
    daysToWaistGoal: daysToGoal,
    startWeight: 230,
    targetWeight: 210,
  });
});
 
export default router;
