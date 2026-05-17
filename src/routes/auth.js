import express from 'express';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
 
dotenv.config();
const router = express.Router();
 
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);
 
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
 
// Step 1 — Redirect user to Whoop login
router.get('/login', (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.WHOOP_CLIENT_ID,
    redirect_uri: process.env.WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: 'read:recovery read:sleep read:workout read:body_measurement read:cycles offline',
  });
  res.redirect(`${WHOOP_AUTH_URL}?${params}`);
});
 
// Step 2 — Whoop redirects back here with a code
router.get('/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect(`${process.env.FRONTEND_URL}?error=no_code`);
 
  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(WHOOP_TOKEN_URL,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: process.env.WHOOP_REDIRECT_URI,
        client_id: process.env.WHOOP_CLIENT_ID,
        client_secret: process.env.WHOOP_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
 
    const { access_token, refresh_token, expires_in } = tokenRes.data;
 
    // Get Whoop user profile
    const profileRes = await axios.get('https://api.prod.whoop.com/developer/v1/user/profile/basic', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
 
    const whoopUser = profileRes.data;
    const userId = String(whoopUser.user_id);
 
    // Upsert user in Supabase
    await supabase.from('users').upsert({
      whoop_user_id: userId,
      email: whoopUser.email,
      first_name: whoopUser.first_name,
      last_name: whoopUser.last_name,
      access_token,
      refresh_token,
      token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: 'whoop_user_id' });
 
    // Redirect to frontend with user ID (frontend stores this)
    res.redirect(`${process.env.FRONTEND_URL}?userId=${userId}&success=true`);
 
  } catch (err) {
    console.error('Auth callback error:', err.response?.data || err.message);
    res.redirect(`${process.env.FRONTEND_URL}?error=auth_failed`);
  }
});
 
// Refresh token
router.post('/refresh', async (req, res) => {
  const { userId } = req.body;
  try {
    const { data: user } = await supabase
      .from('users').select('refresh_token').eq('whoop_user_id', userId).single();
 
    const tokenRes = await axios.post(WHOOP_TOKEN_URL,
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
 
    res.json({ success: true });
  } catch (err) {
    res.status(401).json({ error: 'Token refresh failed' });
  }
});
 
export default router;
