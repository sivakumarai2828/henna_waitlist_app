import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import KioskView from './pages/KioskView';
import JoinView from './pages/JoinView';
import AdminView from './pages/AdminView';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<KioskView />} />
        <Route path="/join" element={<JoinView />} />
        <Route path="/admin" element={<AdminView />} />
      </Routes>
    </Router>
  );
}

export default App;
