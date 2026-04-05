import { useEffect, useState } from 'react';
import { QRCode } from 'react-qr-code';
import { io } from 'socket.io-client';
import { Clock, Users } from 'lucide-react';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const KioskView = () => {
  const [queueState, setQueueState] = useState({ totalWaiting: 0, isPaused: false, activeUser: null });
  const [joinUrl, setJoinUrl] = useState('');

  useEffect(() => {
    // Build join URL using current host so QR works on local network
    const host = window.location.host;
    setJoinUrl(`${window.location.protocol}//${host}/join`);

    const socket = io(SOCKET_URL);
    socket.on('queueUpdated', (data) => setQueueState(data));
    return () => socket.close();
  }, []);

  return (
    <div className="kiosk-root">
      {/* Left Panel */}
      <div className="kiosk-left">
        <div className="kiosk-brand">
          <div className="kiosk-henna-icon">🌿</div>
          <h1 className="kiosk-title">Anuus Henna</h1>
          <p className="kiosk-subtitle">Traditional Mehndi Art</p>
        </div>

        <div className="kiosk-stats">
          <div className="kiosk-stat-card">
            <Users size={22} className="kiosk-stat-icon" />
            <div>
              <span className="kiosk-stat-label">Currently Waiting</span>
              <span className="kiosk-stat-number">{queueState.totalWaiting}</span>
            </div>
          </div>
          {queueState.activeUser && (
            <div className="kiosk-stat-card serving">
              <Clock size={22} className="kiosk-stat-icon" />
              <div>
                <span className="kiosk-stat-label">Now Serving</span>
                <span className="kiosk-stat-number" style={{ fontSize: '1.1rem' }}>{queueState.activeUser.name}</span>
              </div>
            </div>
          )}
        </div>

        {queueState.isPaused && (
          <div className="kiosk-paused-badge">Queue Temporarily Paused</div>
        )}

        <p className="kiosk-tagline">
          "Beautiful henna crafted with love & tradition"
        </p>
      </div>

      {/* Right Panel - QR */}
      <div className="kiosk-right">
        <div className="kiosk-qr-card">
          <p className="kiosk-qr-step">STEP 1</p>
          <h2 className="kiosk-qr-heading">Scan to Join Queue</h2>
          <p className="kiosk-qr-desc">Use your phone camera to scan and reserve your spot instantly</p>

          <div className="kiosk-qr-frame">
            {joinUrl && (
              <QRCode
                value={joinUrl}
                size={220}
                bgColor="#FFFFFF"
                fgColor="#2D1B4E"
                level="M"
              />
            )}
          </div>

          <div className="kiosk-qr-divider">
            <span>or visit</span>
          </div>
          <p className="kiosk-qr-url">{joinUrl}</p>

          <div className="kiosk-steps">
            <div className="kiosk-step"><span>1</span> Scan QR code</div>
            <div className="kiosk-step"><span>2</span> Enter your name & phone</div>
            <div className="kiosk-step"><span>3</span> Relax — we'll text you!</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KioskView;
