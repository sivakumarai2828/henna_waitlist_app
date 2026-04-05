import { useState } from 'react';
import { Lock } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const AdminLogin = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      localStorage.setItem('adminToken', data.token);
      onLogin(data.token);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  return (
    <div className="admin-login-root">
      <div className="admin-login-card">
        <div className="admin-login-icon">
          <Lock size={28} />
        </div>
        <h2>Admin Access</h2>
        <p>Enter your password to manage the queue</p>
        <form onSubmit={handleSubmit} className="admin-login-form">
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          {error && <p className="admin-login-error">{error}</p>}
          <button type="submit" className="admin-btn primary" disabled={loading}
            style={{ padding: '0.9rem', fontSize: '0.95rem' }}>
            {loading ? 'Verifying...' : 'Login →'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
