import { useEffect, useMemo, useState } from 'react';
import tuyaService from '../../services/tuya';
import sitesZonesService from '../../services/sitesZones';

export default function SitesZonesPage() {
    const [rooms, setRooms] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [savingRoomId, setSavingRoomId] = useState(null);
    const [createLoading, setCreateLoading] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [form, setForm] = useState({ name: '', description: '' });

    const loadRoomsFromTuya = async ({ silent = false } = {}) => {
        try {
            const response = await sitesZonesService.syncTuyaRooms();
            const syncedRooms = response?.data?.data;

            if (!silent && Array.isArray(syncedRooms) && syncedRooms.length > 0) {
                setFeedback(`${syncedRooms.length} piece(s) Tuya synchronisee(s).`);
            }

            return true;
        } catch (err) {
            const message = err.response?.data?.message || '';

            if (!silent && message) {
                setError(message);
            }

            return false;
        }
    };

    const devicesById = useMemo(() => {
        return new Map(devices.map((device) => [device.id, device]));
    }, [devices]);

    const tuyaRooms = useMemo(() => {
        return rooms.filter((room) => Boolean(room.tuyaRoomId));
    }, [rooms]);

    const loadRooms = async () => {
        setLoadingRooms(true);

        try {
            const response = await sitesZonesService.getRooms();
            setRooms(response.data?.data || []);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de charger les pieces.';
            setError(message);
            setRooms([]);
        } finally {
            setLoadingRooms(false);
        }
    };

    const loadDevices = async () => {
        setLoadingDevices(true);

        try {
            const response = await tuyaService.getDevices();
            setDevices(response.data?.data || []);
        } catch {
            setDevices([]);
        } finally {
            setLoadingDevices(false);
        }
    };

    useEffect(() => {
        const bootstrap = async () => {
            setError('');
            await loadRoomsFromTuya({ silent: true });
            await Promise.all([loadRooms(), loadDevices()]);
        };

        bootstrap();
    }, []);

    const handleCreateRoom = async (event) => {
        event.preventDefault();
        setError('');
        setFeedback('');

        if (!form.name.trim()) {
            setError('Le nom de la piece est obligatoire.');
            return;
        }

        setCreateLoading(true);

        try {
            const response = await sitesZonesService.createRoom({
                name: form.name.trim(),
                description: form.description.trim() || null,
            });

            const createdRoom = response.data?.data;
            if (createdRoom) {
                setRooms((prev) => [...prev, createdRoom].sort((a, b) => a.name.localeCompare(b.name)));
            }

            setForm({ name: '', description: '' });
            setFeedback('Piece creee. Vous pouvez maintenant y affecter des equipements.');
        } catch (err) {
            const message = err.response?.data?.message || 'Creation impossible pour le moment.';
            setError(message);
        } finally {
            setCreateLoading(false);
        }
    };

    const persistRoomDevices = async (room, nextDeviceIds) => {
        setSavingRoomId(room.id);
        setError('');
        setFeedback('');

        const previousRooms = rooms;

        setRooms((prev) => prev.map((item) => {
            if (item.id !== room.id) {
                return item;
            }

            return {
                ...item,
                deviceIds: nextDeviceIds,
                devicesCount: nextDeviceIds.length,
            };
        }));

        try {
            await sitesZonesService.updateRoom(room.id, { deviceIds: nextDeviceIds });
            setFeedback(`Affectation mise a jour pour ${room.name}.`);
        } catch (err) {
            setRooms(previousRooms);
            const message = err.response?.data?.message || 'Impossible de sauvegarder cette affectation.';
            setError(message);
        } finally {
            setSavingRoomId(null);
        }
    };

    const handleToggleDevice = (room, deviceId, checked) => {
        const current = Array.isArray(room.deviceIds) ? room.deviceIds : [];
        const nextDeviceIds = checked
            ? Array.from(new Set([...current, deviceId]))
            : current.filter((id) => id !== deviceId);

        persistRoomDevices(room, nextDeviceIds);
    };

    const handleDeleteRoom = async (room) => {
        const shouldDelete = window.confirm(`Supprimer la piece \"${room.name}\" ?`);
        if (!shouldDelete) {
            return;
        }

        setSavingRoomId(room.id);
        setError('');
        setFeedback('');

        try {
            await sitesZonesService.deleteRoom(room.id);
            setRooms((prev) => prev.filter((item) => item.id !== room.id));
            setFeedback(`Piece ${room.name} supprimee.`);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de supprimer cette piece.';
            setError(message);
        } finally {
            setSavingRoomId(null);
        }
    };

    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>Sites & Zones</h1>
                <p>Creez des pieces et affectez vos equipements Tuya comme dans l'organisation Tuya.</p>
            </header>

            <div className="sites-zones-layout">
                <article className="panel sites-zones-create-panel">
                    <div className="panel-head">
                        <h2>Nouvelle piece</h2>
                    </div>

                    <form className="sites-zones-form" onSubmit={handleCreateRoom}>
                        <label>
                            Nom de la piece
                            <input
                                type="text"
                                value={form.name}
                                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                placeholder="Ex: Bureau R+1"
                                maxLength={120}
                            />
                        </label>

                        <label>
                            Description (optionnel)
                            <textarea
                                value={form.description}
                                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                placeholder="Contexte thermique ou type de zone"
                                maxLength={500}
                                rows={4}
                            />
                        </label>

                        <button type="submit" disabled={createLoading}>
                            {createLoading ? 'Creation...' : 'Creer la piece'}
                        </button>
                    </form>

                    {error && <div className="tuya-feedback error"><p>{error}</p></div>}
                    {feedback && <div className="tuya-feedback success"><p>{feedback}</p></div>}
                </article>

                <article className="panel sites-zones-rooms-panel">
                    <div className="panel-head">
                        <div>
                            <h2>Pieces configurees</h2>
                            <p>Affectez un equipement a une ou plusieurs pieces.</p>
                        </div>
                        <button
                            type="button"
                            className="refresh-button"
                            onClick={async () => {
                                setError('');
                                setFeedback('');
                                await loadRoomsFromTuya();
                                await Promise.all([loadRooms(), loadDevices()]);
                            }}
                            disabled={loadingRooms || loadingDevices}
                        >
                            {(loadingRooms || loadingDevices) ? 'Chargement...' : 'Rafraichir'}
                        </button>
                    </div>

                    <div className="tuya-rooms-panel">
                        <div className="tuya-rooms-panel-head">
                            <h3>Pieces Tuya detectees</h3>
                            <span>{tuyaRooms.length}</span>
                        </div>

                        {loadingRooms && <p className="tuya-hint">Lecture des pieces Tuya...</p>}

                        {!loadingRooms && tuyaRooms.length === 0 && (
                            <p className="tuya-hint">
                                Aucune piece Tuya detectee. Verifiez Home ID puis cliquez sur Rafraichir.
                            </p>
                        )}

                        {!loadingRooms && tuyaRooms.length > 0 && (
                            <div className="tuya-rooms-list">
                                {tuyaRooms.map((room) => (
                                    <article key={`tuya-${room.id}`} className="tuya-room-item">
                                        <p className="tuya-room-name">{room.name}</p>
                                        <p className="tuya-room-meta">
                                            ID Tuya: {room.tuyaRoomId}
                                            {room.syncedAt ? ` • Sync: ${new Date(room.syncedAt).toLocaleString()}` : ''}
                                        </p>
                                    </article>
                                ))}
                            </div>
                        )}
                    </div>

                    {loadingRooms && <p className="tuya-hint">Chargement des pieces...</p>}

                    {!loadingRooms && rooms.length === 0 && (
                        <p className="tuya-hint">Aucune piece pour l'instant. Creez-en une pour commencer.</p>
                    )}

                    {!loadingRooms && rooms.length > 0 && (
                        <div className="rooms-grid">
                            {rooms.map((room) => {
                                const selectedDeviceIds = Array.isArray(room.deviceIds) ? room.deviceIds : [];
                                const busy = savingRoomId === room.id;

                                return (
                                    <article key={room.id} className="room-card">
                                        <div className="room-card-head">
                                            <div>
                                                <h3>{room.name}</h3>
                                                <p>{room.description || 'Aucune description'}</p>
                                            </div>
                                            <button
                                                type="button"
                                                className="room-delete-btn"
                                                onClick={() => handleDeleteRoom(room)}
                                                disabled={busy}
                                            >
                                                Supprimer
                                            </button>
                                        </div>

                                        <p className="room-count">{selectedDeviceIds.length} equipement(s) affecte(s)</p>

                                        <p className={`room-sync-badge ${room.syncStatus || 'local'}`}>
                                            {room.syncStatus === 'synced' && 'Synchronise Tuya / Smart Life'}
                                            {room.syncStatus === 'warning' && 'Synchronisation partielle'}
                                            {(!room.syncStatus || room.syncStatus === 'local') && 'Local uniquement'}
                                        </p>

                                        {room.syncMessage && (
                                            <p className="room-sync-message">{room.syncMessage}</p>
                                        )}

                                        {loadingDevices && <p className="tuya-hint">Chargement des equipements...</p>}

                                        {!loadingDevices && devices.length === 0 && (
                                            <p className="tuya-hint">
                                                Aucun equipement Tuya disponible. Connectez d'abord l'API Tuya.
                                            </p>
                                        )}

                                        {!loadingDevices && devices.length > 0 && (
                                            <div className="room-device-list">
                                                {devices.map((device) => {
                                                    const checked = selectedDeviceIds.includes(device.id);
                                                    const labelSuffix = device.category ? ` (${device.category})` : '';

                                                    return (
                                                        <label key={device.id} className="room-device-item">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={(event) => handleToggleDevice(room, device.id, event.target.checked)}
                                                                disabled={busy}
                                                            />
                                                            <span>
                                                                {device.name}
                                                                {labelSuffix}
                                                                {!devicesById.has(device.id) ? ' (indisponible)' : ''}
                                                            </span>
                                                        </label>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </article>
            </div>
        </section>
    );
}
