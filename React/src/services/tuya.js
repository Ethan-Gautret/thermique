import api from './api';

export const tuyaService = {
  // Vérifier si l'utilisateur a une connexion Tuya sauvegardée côté serveur
  getTuyaConnection: () =>
    api.get('/tuya/connection'),

  // Sauvegarder les credentials Tuya pour l'utilisateur connecté
  connectTuya: (clientId, clientSecret, region = 'eu', homeId = '') =>
    api.post('/tuya/connect', {
      clientId,
      clientSecret,
      region,
      homeId: homeId || null,
    }).then((res) => res.data),

  // Récupérer la liste des appareils
  getDevices: () =>
    api.get('/tuya/devices'),

  // Déconnecter Tuya
  disconnectTuya: () => api.post('/tuya/disconnect').then((res) => res.data),

  // Contrôler un appareil
  controlDevice: (deviceId, command, value) =>
    api.post('/tuya/device/control', { deviceId, command, value }),

  // Mettre à jour la catégorie d'un équipement
  updateDeviceCategory: (tuyaDeviceId, categoryId) =>
    api.put(`/tuya/devices/${tuyaDeviceId}/category`, { category_id: categoryId }),

  // Supprimer un équipement côté site (et base locale)
  deleteDevice: (tuyaDeviceId) =>
    api.delete(`/tuya/devices/${tuyaDeviceId}`),
};

export default tuyaService;
