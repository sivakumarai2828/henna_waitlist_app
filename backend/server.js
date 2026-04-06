import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import queueManager from './queueManager.js';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*'
}));
app.use(express.json());

// --- AUTH MIDDLEWARE ---
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// --- SOCKET.IO ---
io.on('connection', async (socket) => {
  console.log('New client connected:', socket.id);
  socket.emit('queueUpdated', await queueManager.getQueueState());
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const broadcastQueueUpdate = async () => {
  io.emit('queueUpdated', await queueManager.getQueueState());
};

// --- AUTH ROUTES ---
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body;
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid password' });
  }
  const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token });
});

// --- QUEUE ROUTES ---

app.get('/api/queue', async (_req, res) => {
  try {
    res.json(await queueManager.getQueueState());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/queue/join', async (req, res) => {
  const { name, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  try {
    const { user, estimatedWaitTime } = await queueManager.joinQueue(name, email);
    await broadcastQueueUpdate();
    res.status(201).json({ user, estimatedWaitTime });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/queue/leave/:id', async (req, res) => {
  try {
    await queueManager.leaveQueue(req.params.id);
    await broadcastQueueUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/queue/entry/:id', async (req, res) => {
  try {
    const entry = await queueManager.getEntryStatus(req.params.id);
    if (!entry) return res.json({ status: 'not_found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin-protected routes below
app.post('/api/queue/next', requireAdmin, async (_req, res) => {
  try {
    const nextUser = await queueManager.serveNext();
    await broadcastQueueUpdate();
    res.json({ success: true, nextUser });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/queue/skip/:id', requireAdmin, async (req, res) => {
  try {
    await queueManager.skipUser(req.params.id);
    await broadcastQueueUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/queue/toggle-pause', requireAdmin, async (_req, res) => {
  try {
    const isPaused = await queueManager.togglePause();
    await broadcastQueueUpdate();
    res.json({ success: true, isPaused });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/queue/reset', requireAdmin, async (_req, res) => {
  try {
    await queueManager.resetQueue();
    await broadcastQueueUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/queue/refresh', requireAdmin, async (_req, res) => {
  try {
    await broadcastQueueUpdate();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats', requireAdmin, async (_req, res) => {
  try {
    res.json(await queueManager.getStats());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Backend server running on port ${PORT}`);
  // Reset any stale 'serving' entries from previous session back to 'waiting'
  await queueManager.resetStaleServing();
});
