import { useState, useEffect } from 'react';
import tuyaService from '../services/tuya';

export default function TuyaDevices({ onDisconnect }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [controlling, setControlling] = useState(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const result = await tuyaService.getDevices();
      setDevices(result.data || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la récupération des appareils');
      console.error('Fetch devices error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleControlDevice = async (deviceId, command, value) => {
    try {
      setControlling(deviceId);
      await tuyaService.controlDevice(deviceId, command, value);
      // Rafraîchir la liste après le contrôle
      fetchDevices();
    } catch (err) {
      setError('Erreur lors du contrôle de l\'appareil');
      console.error('Control device error:', err);
    } finally {
      setControlling(null);
    }
  };

  const handleDisconnect = async () => {
    try {
      await tuyaService.disconnectTuya();
      onDisconnect?.();
    } catch (err) {
      console.error('Disconnect error:', err);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <span className="ml-4 text-gray-600">Chargement des appareils...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Vos Appareils Tuya</h2>
        <button
          onClick={handleDisconnect}
          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition"
        >
          Déconnecter Tuya
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {devices.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Aucun appareil trouvé</p>
          <p className="text-gray-400 text-sm mt-2">
            Vérifiez que vous avez des appareils liés à votre compte Tuya
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device) => (
            <div
              key={device.id}
              className="border border-gray-200 rounded-lg p-5 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-800">{device.name}</h3>
                  <p className="text-xs text-gray-500 mt-1">{device.category}</p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${device.online
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700'
                    }`}
                >
                  {device.online ? 'En ligne' : 'Hors ligne'}
                </span>
              </div>

              {device.properties && device.properties.length > 0 && (
                <div className="space-y-3 mt-4">
                  {device.properties.map((prop) => (
                    <div key={prop.code} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{prop.name}</span>
                      {prop.type === 'bool' ? (
                        <button
                          onClick={() => handleControlDevice(device.id, prop.code, !prop.value)}
                          disabled={controlling === device.id || !device.online}
                          className={`px-3 py-1 rounded text-xs font-medium transition ${prop.value
                              ? 'bg-green-500 text-white hover:bg-green-600'
                              : 'bg-gray-300 text-gray-700 hover:bg-gray-400'
                            } ${controlling === device.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {prop.value ? 'Activé' : 'Désactivé'}
                        </button>
                      ) : (
                        <span className="text-sm font-medium text-gray-800">
                          {prop.value} {prop.unit || ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-xs text-gray-400">ID: {device.id}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={fetchDevices}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
        >
          🔄 Rafraîchir
        </button>
      </div>
    </div>
  );
}
