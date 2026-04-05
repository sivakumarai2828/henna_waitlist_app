import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Users, Play, Pause, SkipForward, CheckCircle, RefreshCcw, LogOut, Clock, Wifi, WifiOff } from 'lucide-react';
import AdminLogin from './AdminLogin';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const API_URL = `${SOCKET_URL}/api/queue`;

const AdminView = () => {
  const [token, setToken] = useState(() => localStorage.getItem('adminToken'));
  const [queueState, setQueueState] = useState({ queue: [], activeUser: null, totalWaiting: 0, isPaused: false });
  const [stats, setStats] = useState(null);
  const [connected, setConnected] = useState(true);

  const fetchStats = useCallback(async (t) => {
    try {
      const res = await fetch(`${SOCKET_URL}/api/stats`, {
        headers: { Authorization: `Bearer ${t}` }
      });
      if (res.ok) setStats(await res.json());
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    if (!token) return;
    const socket = io(SOCKET_URL);
    socket.on('connect', () => { setConnected(true); fetchStats(token); });
    socket.on('disconnect', () => setConnected(false));
    socket.on('queueUpdated', (data) => setQueueState(data));
    fetchStats(token);
    return () => socket.close();
  }, [token, fetchStats]);

  const action = async (endpoint) => {
    try {
      const res = await fetch(`${API_URL}/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.status === 401) { handleLogout(); return; }
      await fetchStats(token);
    } catch (err) {
      console.error(`Action ${endpoint} failed`, err);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setToken(null);
  };

  if (!token) return <AdminLogin onLogin={setToken} />;

  return (
    <div className="admin-root">
      <div className="admin-wrap">

        {/* Top bar */}
        <div className="admin-topbar">
          <div className="admin-topbar-left">
            <h1>🌿 Dashboard</h1>
            <p>Anuus Henna Queue Manager</p>
          </div>
          <div className="admin-topbar-right">
            <span className="admin-badge"><Users size={12} style={{ display: 'inline', marginRight: 4 }} />{queueState.totalWaiting} waiting</span>
            <span title={connected ? 'Connected' : 'Disconnected'} style={{ color: connected ? 'var(--success)' : 'var(--danger)', display: 'flex' }}>
              {connected ? <Wifi size={16} /> : <WifiOff size={16} />}
            </span>
            <button className="admin-btn ghost sm" onClick={() => action('refresh')} title="Refresh Queue">
              <RefreshCcw size={14} />
            </button>
            <button className="admin-btn ghost sm" onClick={handleLogout} title="Logout">
              <LogOut size={14} />
            </button>
          </div>
        </div>

        {/* Stats */}
        {stats && (
          <div className="admin-stats">
            <div className="admin-stat">
              <div className="admin-stat-icon"><Users size={16} color="var(--plum)" /></div>
              <div className="admin-stat-label">Joined Today</div>
              <div className="admin-stat-val">{stats.totalJoinedToday}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-icon"><CheckCircle size={16} color="var(--success)" /></div>
              <div className="admin-stat-label">Served Today</div>
              <div className="admin-stat-val">{stats.totalServedToday}</div>
            </div>
            <div className="admin-stat">
              <div className="admin-stat-icon"><Clock size={16} color="var(--gold)" /></div>
              <div className="admin-stat-label">Avg. Time</div>
              <div className="admin-stat-val">{stats.averageServiceMinutes}m</div>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="admin-controls">
          <button
            className="admin-btn primary"
            onClick={() => action('next')}
            disabled={queueState.isPaused || queueState.totalWaiting === 0}
          >
            <CheckCircle size={16} /> Next
          </button>
          <button
            className={`admin-btn ${queueState.isPaused ? 'success' : 'warning'}`}
            onClick={() => action('toggle-pause')}
          >
            {queueState.isPaused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
          </button>
          <button className="admin-btn danger sm" onClick={() => action('reset')}>
            <RefreshCcw size={14} /> Reset
          </button>
        </div>

        {/* Currently Serving */}
        <div className="admin-active">
          <div className="admin-section-label">Currently Serving</div>
          {queueState.activeUser ? (
            <>
              <div className="admin-active-name">{queueState.activeUser.name}</div>
              <div className="admin-active-phone">{queueState.activeUser.phone}</div>
            </>
          ) : (
            <div className="admin-empty">No one is being served right now.</div>
          )}
        </div>

        {/* Queue List */}
        <div className="admin-queue">
          <div className="admin-section-label">Up Next — {queueState.totalWaiting} waiting</div>
          {queueState.queue.length === 0 ? (
            <div className="admin-empty" style={{ marginTop: '0.5rem' }}>Queue is empty.</div>
          ) : (
            <ul className="admin-queue-list">
              {queueState.queue.map((user, idx) => (
                <li key={user.id} className="admin-queue-item">
                  <div className="admin-queue-info">
                    <span className="admin-rank">#{idx + 1}</span>
                    <div>
                      <div className="admin-queue-name">{user.name}</div>
                      <div className="admin-queue-wait">~{Math.ceil(user.estimatedWaitTimeMs / 60000)} min wait</div>
                    </div>
                  </div>
                  <button className="admin-btn danger sm" onClick={() => action(`skip/${user.id}`)} title="Skip">
                    <SkipForward size={13} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
};

export default AdminView;
