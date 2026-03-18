import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './components/pages/DashboardPage';
import SectionPage from './components/pages/SectionPage';
import SettingsPage from './components/pages/SettingsPage';
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
              element={<SectionPage title="Equipements" subtitle="Etat global des unites de chauffage et ventilation." />}
            />
            <Route
              path="/sites-zones"
              element={<SectionPage title="Sites & Zones" subtitle="Regroupement des batiments et zones thermiques." />}
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
