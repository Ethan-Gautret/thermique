import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './components/pages/DashboardPage';
import EquipementsPage from './components/pages/EquipementsPage';
import SectionPage from './components/pages/SectionPage';
import SettingsPage from './components/pages/SettingsPage';
import SitesZonesPage from './components/pages/SitesZonesPage';
import './styles/dashboard.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route
              path="/calendrier"
              element={<SectionPage title="Calendrier" subtitle="Planification hebdomadaire et operations programmees." />}
            />
            <Route
              path="/equipements"
              element={<EquipementsPage />}
            />
            <Route
              path="/sites-zones"
              element={<SitesZonesPage />}
            />
            <Route
              path="/scenarios"
              element={<SectionPage title="Scenarios" subtitle="Configurations de confort, eco et maintenance." />}
            />
            <Route
              path="/automations"
              element={<SectionPage title="Automations" subtitle="Regles automatiques basees sur les seuils capteurs." />}
            />
            <Route
              path="/alertes"
              element={<SectionPage title="Alertes" subtitle="Suivi des incidents, priorites et acquittements." />}
            />
            <Route
              path="/rapports"
              element={<SectionPage title="Rapports" subtitle="KPI energetiques et exports d'exploitation." />}
            />
            <Route
              path="/parametres"
              element={<SettingsPage />}
            />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
