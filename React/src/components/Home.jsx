import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/api';
import tuyaService from '../services/tuya';
import TuyaConnect from './TuyaConnect';
import TuyaDevices from './TuyaDevices';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tuyaConnected, setTuyaConnected] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await authService.getCurrentUser();
        setUser(response.data);

        // Vérifier la connexion Tuya
        checkTuyaConnection();
      } catch (err) {
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [navigate]);

  const checkTuyaConnection = async () => {
    try {
      const result = await tuyaService.getTuyaConnection();
      setTuyaConnected(true);
    } catch (err) {
      setTuyaConnected(false);
    }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
      navigate('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const handleTuyaConnected = () => {
    setTuyaConnected(true);
    setActiveTab('devices');
  };

  const handleTuyaDisconnected = () => {
    setTuyaConnected(false);
    setActiveTab('profile');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-white text-xl">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-lg">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-orange-500">Thermique</h1>
          <div className="flex items-center space-x-4">
            <span className="text-gray-700">
              {user?.name} <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded-full ml-2">{user?.role}</span>
            </span>
            <button
              onClick={handleLogout}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg transition"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-12">
        {/* Tabs */}
        <div className="flex space-x-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === 'profile'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
          >
            👤 Profil
          </button>
          <button
            onClick={() => setActiveTab('tuya')}
            className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === 'tuya'
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-600 hover:text-gray-800'
              }`}
          >
            🔗 Tuya {tuyaConnected && <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full"></span>}
          </button>
          {tuyaConnected && (
            <button
              onClick={() => setActiveTab('devices')}
              className={`px-4 py-3 font-medium border-b-2 transition ${activeTab === 'devices'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-600 hover:text-gray-800'
                }`}
            >
              📱 Appareils
            </button>
          )}
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-xl p-8">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">Bienvenue, {user?.name} ! 👋</h2>
            <p className="text-gray-600 mb-6">Vous êtes connecté avec succès à l'application Thermique.</p>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Informations du compte</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Nom :</span>
                  <span className="font-medium text-gray-800">{user?.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email :</span>
                  <span className="font-medium text-gray-800">{user?.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Rôle :</span>
                  <span className={`font-medium px-3 py-1 rounded-full ${user?.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                    {user?.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
                  </span>
                </div>
                {user?.group && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Groupe :</span>
                    <span className="font-medium text-gray-800">{user.group.name}</span>
                  </div>
                )}
              </div>
            </div>

            {user?.role === 'admin' && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4">
                <p className="text-blue-700">Vous avez accès aux fonctionnalités d'administration.</p>
              </div>
            )}
          </div>
        )}

        {/* Tuya Connect Tab */}
        {activeTab === 'tuya' && (
          <div className="max-w-2xl mx-auto">
            {!tuyaConnected ? (
              <TuyaConnect onConnected={handleTuyaConnected} />
            ) : (
              <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                <div className="text-green-500 text-5xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Tuya Connecté</h2>
                <p className="text-gray-600 mb-6">Votre API Tuya est connectée avec succès.</p>
                <button
                  onClick={() => setActiveTab('devices')}
                  className="bg-orange-500 hover:bg-orange-600 text-white px-6 py-3 rounded-lg transition"
                >
                  Voir Mes Appareils →
                </button>
              </div>
            )}
          </div>
        )}

        {/* Devices Tab */}
        {activeTab === 'devices' && tuyaConnected && (
          <TuyaDevices onDisconnect={handleTuyaDisconnected} />
        )}
      </div>
    </div>
  );
}
