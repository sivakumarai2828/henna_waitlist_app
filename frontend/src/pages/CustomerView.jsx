import { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Clock, User, QrCode, LogOut } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${SOCKET_URL}/api/queue`;

const CustomerView = () => {
  const [queueState, setQueueState] = useState(null);
  const [joinedUser, setJoinedUser] = useState(() => {
    const saved = localStorage.getItem('joinedUser');
    return saved ? JSON.parse(saved) : null;
  });
  const [formData, setFormData] = useState({ name: '', phone: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const socket = io(SOCKET_URL);
    socket.on('queueUpdated', (data) => setQueueState(data));
    return () => socket.close();
  }, []);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
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
      localStorage.setItem('joinedUser', JSON.stringify(data.user));
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleLeave = async () => {
    if (!joinedUser) return;
    try {
      await fetch(`${API_URL}/leave/${joinedUser.id}`, { method: 'POST' });
    } catch {
      // best effort
    }
    setJoinedUser(null);
    localStorage.removeItem('joinedUser');
  };

  const getUserStatus = () => {
    if (!queueState || !joinedUser) return null;

    if (queueState.activeUser && queueState.activeUser.id === joinedUser.id) {
      return { status: 'serving', title: "It's your turn!", message: 'Please approach the stall now.' };
    }

    const position = queueState.queue.findIndex(q => q.id === joinedUser.id);
    if (position >= 0) {
      const userState = queueState.queue[position];
      return {
        status: 'waiting',
        position: position + 1,
        waitTimeMinutes: Math.ceil(userState.estimatedWaitTimeMs / 60000)
      };
    }

    return { status: 'completed', title: 'You have been served!', message: 'Thank you for visiting.' };
  };

  const statusInfo = getUserStatus();

  return (
    <div className="container customer-view">
      <div className="header glass">
        <h1>✨ Anuus Henna ✨</h1>
        {queueState && (
          <div className="queue-global-status">
            {queueState.isPaused ? (
              <span className="badge warning">Queue Paused</span>
            ) : (
              <span><Clock size={16} /> {queueState.totalWaiting} in line</span>
            )}
          </div>
        )}
      </div>

      <div className="content">
        {!joinedUser ? (
          <div className="card glass bounce-in">
            <div className="card-icon"><QrCode size={48} /></div>
            <h2>Join the Queue</h2>
            <p>Enter your details below to instantly reserve your spot. We will notify you when it's your turn!</p>
            <form onSubmit={handleJoin} className="form-group">
              <input
                type="text"
                placeholder="Your Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <input
                type="tel"
                placeholder="Phone Number"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                required
              />
              {error && <p style={{ color: 'var(--danger)', fontSize: '0.9rem' }}>{error}</p>}
              <button type="submit" className="btn primary" disabled={loading || (queueState && queueState.isPaused)}>
                {loading ? 'Joining...' : 'Join Now 🚀'}
              </button>
            </form>
          </div>
        ) : (
          <div className="card glass slide-up">
            <div className="ticket-header">
              <h3>Hello, {joinedUser.name}</h3>
            </div>

            {statusInfo?.status === 'waiting' && (
              <div className="ticket-body">
                <div className="position-box">
                  <span className="label">Your Position</span>
                  <span className="number pulse">{statusInfo.position}</span>
                </div>
                <div className="wait-box">
                  <Clock size={20} />
                  <span>Est. wait time: <strong>~{statusInfo.waitTimeMinutes} mins</strong></span>
                </div>
                <p className="notif-hint">We'll text you when you're up!</p>
                <button
                  className="btn danger"
                  style={{ marginTop: '1.5rem' }}
                  onClick={handleLeave}
                >
                  <LogOut size={16} /> Leave Queue
                </button>
              </div>
            )}

            {statusInfo?.status === 'serving' && (
              <div className="ticket-body highlight-active pulse">
                <div className="card-icon success"><User size={48} /></div>
                <h2>{statusInfo.title}</h2>
                <p>{statusInfo.message}</p>
              </div>
            )}

            {statusInfo?.status === 'completed' && (
              <div className="ticket-body">
                <h2>{statusInfo.title}</h2>
                <p>{statusInfo.message}</p>
                <button className="btn secondary" onClick={() => {
                  setJoinedUser(null);
                  localStorage.removeItem('joinedUser');
                }}>Join Again</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerView;
