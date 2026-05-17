import { createClient } from '@supabase/supabase-js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
 
export async function requireAuth(req, res, next) {
  const userId = req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Not authenticated' });
 
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('whoop_user_id', userId)
      .single();
 
    if (error || !user) return res.status(401).json({ error: 'User not found' });
 
    // Auto-refresh token if expired
    const expiresAt = new Date(user.token_expires_at);
    if (expiresAt <= new Date()) {
      const tokenRes = await axios.post(
        'https://api.prod.whoop.com/oauth/oauth2/token',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.refresh_token,
          client_id: process.env.WHOOP_CLIENT_ID,
          client_secret: process.env.WHOOP_CLIENT_SECRET,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );
      const { access_token, refresh_token, expires_in } = tokenRes.data;
      await supabase.from('users').update({
        access_token,
        refresh_token,
        token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      }).eq('whoop_user_id', userId);
      user.access_token = access_token;
    }
 
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err.message);
    res.status(401).json({ error: 'Authentication failed' });
  }
}
