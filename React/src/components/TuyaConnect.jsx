import { useState } from 'react';
import tuyaService from '../services/tuya';

export default function TuyaConnect({ onConnected }) {
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [region, setRegion] = useState('eu');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!clientId || !clientSecret) {
        throw new Error('Veuillez remplir tous les champs');
      }

      const result = await tuyaService.connectTuya(clientId, clientSecret, region);
      onConnected?.(result);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Erreur de connexion à Tuya');
      console.error('Tuya connection error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Connecter Tuya</h2>
      <p className="text-gray-600 text-sm mb-6">
        Entrez vos identifiants Tuya pour accéder à vos appareils
      </p>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client ID
          </label>
          <input
            type="text"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            placeholder="Votre Client ID Tuya"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <p className="text-gray-500 text-xs mt-1">
            Trouvez-le dans le <a href="https://iot.tuya.com" target="_blank" rel="noopener noreferrer" className="text-orange-500 hover:underline">Tuya IoT Console</a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Client Secret
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Votre Client Secret Tuya"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent pr-10"
            />
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showSecret ? '👁️' : '👁️‍🗨️'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Région
          </label>
          <select
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          >
            <option value="eu">Europe (EU)</option>
            <option value="us">États-Unis (US)</option>
            <option value="cn">Chine (CN)</option>
            <option value="in">Inde (IN)</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-medium py-3 px-4 rounded-lg transition duration-200"
        >
          {loading ? 'Connexion en cours...' : 'Connecter Tuya'}
        </button>
      </form>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-blue-700 text-xs">
          <strong>⚠️ Sécurité :</strong> Vos identifiants Tuya are stored auf de manière sécurisée sur notre serveur. Ils ne sont jamais partagés avec des tiers.
        </p>
      </div>
    </div>
  );
}
