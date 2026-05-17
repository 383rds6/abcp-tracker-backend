import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import whoopRoutes from './routes/whoop.js';
import logsRoutes from './routes/logs.js';
import { requireAuth } from './middleware/auth.js';
 
dotenv.config();
 
const app = express();
const PORT = process.env.PORT || 3001;
 
app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));
app.use(express.json());
 
// Public routes
app.use('/api/auth', authRoutes);
 
// Protected routes (require Whoop login)
app.use('/api/whoop', requireAuth, whoopRoutes);
app.use('/api/logs', requireAuth, logsRoutes);
 
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
 
app.listen(PORT, () => console.log(`ABCP Tracker backend running on port ${PORT}`));
