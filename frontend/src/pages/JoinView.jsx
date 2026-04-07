import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import { CheckCircle, LogOut, Sparkles } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${SOCKET_URL}/api/queue`;

const playChime = (type = 'position') => {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = type === 'turn'
      ? [523, 659, 784, 1047] // C E G C — celebratory
      : [659, 784];            // E G — gentle nudge

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.4);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.4);
    });

    // Vibrate on mobile
    if (navigator.vibrate) {
      navigator.vibrate(type === 'turn' ? [200, 100, 200] : [150]);
    }
  } catch { /* audio not supported */ }
};

const JoinView = () => {
  const [queueState, setQueueState] = useState(null);
  const [joinedUser, setJoinedUser] = useState(() => {
    const saved = localStorage.getItem('joinedUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [ticketStatus, setTicketStatus] = useState(null);
  const [positionInfo, setPositionInfo] = useState(null);
  const prevPositionRef = useRef(null);
  const prevStatusRef = useRef(null);

  const verifyTicket = useCallback(async (userId) => {
    try {
      const res = await fetch(`${API_URL}/entry/${userId}`);
      const data = await res.json();
      return data?.status || 'not_found';
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('queueUpdated', (data) => setQueueState(data));
    return () => socket.close();
  }, []);

  useEffect(() => {
    if (!queueState || !joinedUser) return;

    if (queueState.activeUser?.id === joinedUser.id) {
      if (prevStatusRef.current !== 'serving') playChime('turn');
      prevStatusRef.current = 'serving';
      setTicketStatus('serving');
      setPositionInfo(null);
      return;
    }

    const idx = queueState.queue.findIndex(q => q.id === joinedUser.id);
    if (idx >= 0) {
      const newPosition = idx + 1;
      if (prevPositionRef.current !== null && newPosition < prevPositionRef.current) {
        playChime('position');
      }
      prevPositionRef.current = newPosition;
      prevStatusRef.current = 'waiting';
      setTicketStatus('waiting');
      setPositionInfo({ position: newPosition });
      return;
    }

    verifyTicket(joinedUser.id).then(status => {
      setTicketStatus(status || 'completed');
      setPositionInfo(null);
    });
  }, [queueState, joinedUser, verifyTicket]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to join');
      setJoinedUser(data.user);
      setTicketStatus('waiting');
      localStorage.setItem('joinedUser', JSON.stringify(data.user));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    try {
      await fetch(`${API_URL}/leave/${joinedUser.id}`, { method: 'POST' });
    } catch { /* best effort */ }
    clearTicket();
  };

  const clearTicket = () => {
    setJoinedUser(null);
    setTicketStatus(null);
    setPositionInfo(null);
    localStorage.removeItem('joinedUser');
    setFormData({ name: '', email: '' });
  };

  return (
    <div className="join-root">
      <div className="join-card">
        {/* Header */}
        <div className="join-header">
          <div className="join-logo">🌿</div>
          <h1 className="join-brand">Anuus Henna</h1>
          {queueState && (
            <span className={`join-status-badge ${queueState.isPaused ? 'paused' : 'open'}`}>
              {queueState.isPaused ? 'Queue Paused' : `${queueState.totalWaiting} in queue`}
            </span>
          )}
        </div>

        {/* Join Form */}
        {!joinedUser && (
          <div className="join-form-section">
            <div className="join-form-header">
              <Sparkles size={20} className="join-form-icon" />
              <h2>Reserve Your Spot</h2>
              <p>Enter your name to join. Add email to get notified when it's your turn</p>
            </div>
            <form onSubmit={handleJoin} className="join-form">
              <div className="join-input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="e.g. Priya Sharma"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="join-input-group">
                <label>Email Address <span style={{ color: '#aaa', fontWeight: 400, fontSize: '0.8rem' }}>(optional)</span></label>
                <input
                  type="email"
                  placeholder="e.g. priya@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {error && <p className="join-error">{error}</p>}
              <button
                type="submit"
                className="join-btn-primary"
                disabled={loading || queueState?.isPaused}
              >
                {loading ? 'Joining...' : queueState?.isPaused ? 'Queue is Paused' : 'Join Queue →'}
              </button>
            </form>
          </div>
        )}

        {/* Ticket — Waiting */}
        {joinedUser && ticketStatus === 'waiting' && positionInfo && (
          <div className="join-ticket">
            <div className="join-ticket-top">
              <p className="join-ticket-greeting">Hi, {joinedUser.name} 👋</p>
              <p className="join-ticket-sub">You're in the queue!</p>
            </div>
            <div className="join-ticket-position">
              <span className="join-ticket-pos-label">Your Position</span>
              <span className="join-ticket-pos-number" style={{ fontFamily: 'Inter, sans-serif' }}>#{positionInfo.position}</span>
            </div>

            <p className="join-ticket-hint">📧 We'll email you when you're almost up. Stay close!</p>
            <button className="join-btn-leave" onClick={handleLeave}>
              <LogOut size={14} /> Leave Queue
            </button>
          </div>
        )}

        {/* Ticket — Serving */}
        {joinedUser && ticketStatus === 'serving' && (
          <div className="join-ticket serving-now">
            <div className="join-serving-icon">
              <CheckCircle size={52} />
            </div>
            <h2 className="join-serving-title">It's Your Turn!</h2>
            <p className="join-serving-msg">Please come to the stall now, {joinedUser.name}!</p>
          </div>
        )}

        {/* Ticket — Completed (genuinely served) */}
        {joinedUser && ticketStatus === 'completed' && (
          <div className="join-ticket completed">
            <div className="join-serving-icon">🌿</div>
            <h2 className="join-serving-title">Thank You!</h2>
            <p className="join-serving-msg">We hope you loved your henna. See you again!</p>
            <button className="join-btn-primary" style={{ marginTop: '1.5rem' }} onClick={clearTicket}>
              Join Again
            </button>
          </div>
        )}

        {/* Ticket — Queue Reset */}
        {joinedUser && (ticketStatus === 'reset' || ticketStatus === 'not_found') && (
          <div className="join-ticket completed">
            <div className="join-serving-icon">⚠️</div>
            <h2 className="join-serving-title">Queue Was Reset</h2>
            <p className="join-serving-msg">The queue has been cleared. Please join again if you'd like a spot.</p>
            <button className="join-btn-primary" style={{ marginTop: '1.5rem' }} onClick={clearTicket}>
              Join Again
            </button>
          </div>
        )}

        {/* Ticket — Skipped */}
        {joinedUser && ticketStatus === 'skipped' && (
          <div className="join-ticket completed">
            <div className="join-serving-icon">⏭️</div>
            <h2 className="join-serving-title">You Were Skipped</h2>
            <p className="join-serving-msg">You were moved out of the queue. Join again to get a new spot!</p>
            <button className="join-btn-primary" style={{ marginTop: '1.5rem' }} onClick={clearTicket}>
              Join Again
            </button>
          </div>
        )}

        {/* Ticket — Left */}
        {joinedUser && ticketStatus === 'left' && (
          <div className="join-ticket completed">
            <div className="join-serving-icon">👋</div>
            <h2 className="join-serving-title">You Left the Queue</h2>
            <p className="join-serving-msg">Come back anytime to join again!</p>
            <button className="join-btn-primary" style={{ marginTop: '1.5rem' }} onClick={clearTicket}>
              Join Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default JoinView;
