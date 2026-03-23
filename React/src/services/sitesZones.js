import api from './api';

const sitesZonesService = {
    getRooms: () => api.get('/sites-zones/rooms'),

    syncTuyaRooms: () => api.post('/sites-zones/sync-tuya'),

    createRoom: (payload) => api.post('/sites-zones/rooms', payload),

    updateRoom: (roomId, payload) => api.put(`/sites-zones/rooms/${roomId}`, payload),

    deleteRoom: (roomId) => api.delete(`/sites-zones/rooms/${roomId}`),
};

export default sitesZonesService;
