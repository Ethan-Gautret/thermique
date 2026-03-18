import api from './api';

export const tuyaService = {
  // Vérifier si l'utilisateur a une connexion Tuya sauvegardée
  getTuyaConnection: () =>
    api.get('/tuya/connection'),

  // Sauvegarder les credentials Tuya
  connectTuya: (clientId, clientSecret, region = 'eu') =>
    api.post('/tuya/connect', { clientId, clientSecret, region }).then((res) => {
      if (res.data.token) {
        localStorage.setItem('tuya_access_token', res.data.token);
        localStorage.setItem('tuya_connected', 'true');
      }
      return res.data;
    }),

  // Récupérer la liste des appareils
  getDevices: () =>
    api.get('/tuya/devices'),

  // Déconnecter Tuya
  disconnectTuya: () => {
    localStorage.removeItem('tuya_access_token');
    localStorage.removeItem('tuya_connected');
    return api.post('/tuya/disconnect');
  },

  // Vérifier que Tuya est connecté
  isTuyaConnected: () => {
    return localStorage.getItem('tuya_connected') === 'true';
  },

  // Contrôler un appareil
  controlDevice: (deviceId, command, value) =>
    api.post('/tuya/device/control', { deviceId, command, value }),
};

export default tuyaService;
