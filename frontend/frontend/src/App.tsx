import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import MapWorkspace from './pages/MapWorkspace';
import './styles/tokens.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/map" element={<MapWorkspace />} />
        <Route path="*" element={<div>404 - Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;