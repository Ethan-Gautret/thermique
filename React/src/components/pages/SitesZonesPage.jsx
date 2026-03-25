import { useEffect, useMemo, useState } from 'react';
import tuyaService from '../../services/tuya';
import sitesZonesService from '../../services/sitesZones';

export default function SitesZonesPage() {
    const [sites, setSites] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [devices, setDevices] = useState([]);
    const [loadingSites, setLoadingSites] = useState(true);
    const [loadingRooms, setLoadingRooms] = useState(true);
    const [loadingDevices, setLoadingDevices] = useState(true);
    const [savingRoomId, setSavingRoomId] = useState(null);
    const [createLoading, setCreateLoading] = useState(false);
    const [createSiteLoading, setCreateSiteLoading] = useState(false);
    const [deletingSiteId, setDeletingSiteId] = useState(null);
    const [attachZoneLoading, setAttachZoneLoading] = useState(false);
    const [error, setError] = useState('');
    const [feedback, setFeedback] = useState('');
    const [form, setForm] = useState({ name: '', description: '', siteId: '', createInTuya: true });
    const [siteForm, setSiteForm] = useState({ name: '', address: '' });
    const [createZoneMode, setCreateZoneMode] = useState('create');
    const [selectedExistingRoomId, setSelectedExistingRoomId] = useState('');
    const [showCreateRoomModal, setShowCreateRoomModal] = useState(false);
    const [selectedSiteForModal, setSelectedSiteForModal] = useState(null);
    const [showCreateSiteModal, setShowCreateSiteModal] = useState(false);
    const [showRoomSettingsModal, setShowRoomSettingsModal] = useState(false);
    const [selectedRoomForSettings, setSelectedRoomForSettings] = useState(null);
    const [showAddEquipmentModal, setShowAddEquipmentModal] = useState(false);
    const [selectedRoomForEquipment, setSelectedRoomForEquipment] = useState(null);
    const [selectedDeviceToAdd, setSelectedDeviceToAdd] = useState('');
    const [editingRoomId, setEditingRoomId] = useState(null);
    const [editingRoomName, setEditingRoomName] = useState('');

    const getRoomSyncLabel = (room) => {
        if (room?.syncStatus === 'warning') {
            return 'Erreur sync Tuya';
        }

        if (room?.syncStatus === 'synced' || room?.tuyaRoomId) {
            return 'Creee dans Tuya';
        }

        return 'Locale uniquement';
    };

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

    const associatedDeviceIds = useMemo(() => {
        const allIds = rooms.flatMap((room) => (Array.isArray(room.deviceIds) ? room.deviceIds : []));
        return Array.from(new Set(allIds));
    }, [rooms]);

    const onlineAssociatedCount = useMemo(() => {
        return associatedDeviceIds.reduce((count, deviceId) => {
            const device = devicesById.get(deviceId);
            return count + (device?.online ? 1 : 0);
        }, 0);
    }, [associatedDeviceIds, devicesById]);

    const roomsBySite = useMemo(() => {
        const grouped = new Map();

        sites.forEach((site) => {
            grouped.set(site.id, []);
        });

        rooms.forEach((room) => {
            if (room.siteId && grouped.has(room.siteId)) {
                grouped.get(room.siteId).push(room);
            }
        });

        return grouped;
    }, [sites, rooms]);

    const roomsWithoutSite = useMemo(() => {
        return rooms.filter((room) => !room.siteId);
    }, [rooms]);

    const existingZonesForAttach = useMemo(() => {
        return rooms
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rooms]);

    const currentSiteRoomsForModal = useMemo(() => {
        if (form.siteId === '') {
            return [];
        }

        return rooms
            .filter((room) => room.siteId === Number(form.siteId))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [rooms, form.siteId]);

    const availableDevicesForModal = useMemo(() => {
        if (!selectedRoomForEquipment) {
            return [];
        }

        const selectedRoomId = selectedRoomForEquipment.id;
        const selectedIds = Array.isArray(selectedRoomForEquipment.deviceIds)
            ? selectedRoomForEquipment.deviceIds
            : [];

        const assignedToOtherRooms = new Set(
            rooms
                .filter((room) => room.id !== selectedRoomId)
                .flatMap((room) => (Array.isArray(room.deviceIds) ? room.deviceIds : []))
        );

        return devices.filter(
            (device) => !selectedIds.includes(device.id) && !assignedToOtherRooms.has(device.id)
        );
    }, [devices, rooms, selectedRoomForEquipment]);

    const loadSites = async () => {
        setLoadingSites(true);

        try {
            const response = await sitesZonesService.getSites();
            setSites(response.data?.data || []);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de charger les sites.';
            setError(message);
            setSites([]);
        } finally {
            setLoadingSites(false);
        }
    };

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
            await Promise.all([loadSites(), loadRooms(), loadDevices()]);
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
                siteId: form.siteId === '' ? null : Number(form.siteId),
                requireTuyaSync: form.createInTuya,
            });

            const createdRoom = response.data?.data;
            const apiMessage = response.data?.message;
            if (createdRoom) {
                setRooms((prev) => [...prev, createdRoom].sort((a, b) => a.name.localeCompare(b.name)));
            }

            setForm({ name: '', description: '', siteId: '', createInTuya: true });
            setFeedback(apiMessage || 'Piece creee. Vous pouvez maintenant y affecter des equipements.');
            setTimeout(() => setShowCreateRoomModal(false), 1500);
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

    const openAddEquipmentModal = (room) => {
        setSelectedRoomForEquipment(room);
        setSelectedDeviceToAdd('');
        setShowAddEquipmentModal(true);
    };

    const handleAddEquipmentToRoom = async (event) => {
        event.preventDefault();

        if (!selectedRoomForEquipment || !selectedDeviceToAdd) {
            setError('Selectionnez un equipement a ajouter.');
            return;
        }

        const current = Array.isArray(selectedRoomForEquipment.deviceIds)
            ? selectedRoomForEquipment.deviceIds
            : [];
        const nextDeviceIds = Array.from(new Set([...current, selectedDeviceToAdd]));

        await persistRoomDevices(selectedRoomForEquipment, nextDeviceIds);

        setShowAddEquipmentModal(false);
        setSelectedRoomForEquipment(null);
        setSelectedDeviceToAdd('');
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
            const response = await sitesZonesService.deleteRoom(room.id);
            setRooms((prev) => prev.filter((item) => item.id !== room.id));
            const apiMessage = response.data?.message;
            setFeedback(apiMessage || `Piece ${room.name} supprimee.`);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de supprimer cette piece.';
            setError(message);
        } finally {
            setSavingRoomId(null);
        }
    };

    const handleUpdateRoomName = async () => {
        const trimmedName = editingRoomName.trim();

        if (!trimmedName) {
            setError('Le nom de la piece est obligatoire.');
            return;
        }

        if (trimmedName === selectedRoomForSettings.name) {
            setError('Le nouveau nom est identique a l\'ancien');
            return;
        }

        setSavingRoomId(selectedRoomForSettings.id);
        setError('');
        setFeedback('');

        try {
            const response = await sitesZonesService.updateRoom(selectedRoomForSettings.id, {
                name: trimmedName,
            });

            const updatedRoom = response.data?.data;
            if (updatedRoom) {
                setRooms((prev) => prev.map((item) => (item.id === updatedRoom.id ? updatedRoom : item)));
                setSelectedRoomForSettings(updatedRoom);
            }

            setEditingRoomId(null);
            setEditingRoomName('');
            setFeedback(`Piece renommee en \"${trimmedName}\".`);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de renommer cette piece.';
            setError(message);
        } finally {
            setSavingRoomId(null);
        }
    };

    const handleDetachRoomFromSite = async (room) => {
        setSavingRoomId(room.id);
        setError('');
        setFeedback('');

        try {
            const response = await sitesZonesService.updateRoom(room.id, { siteId: null });
            const updatedRoom = response.data?.data;

            if (updatedRoom) {
                setRooms((prev) => prev.map((item) => (item.id === updatedRoom.id ? updatedRoom : item)));
            }

            setFeedback(`Piece ${room.name} retiree du site.`);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de retirer cette piece du site.';
            setError(message);
        } finally {
            setSavingRoomId(null);
        }
    };

    const handleCreateSite = async (event) => {
        event.preventDefault();
        setError('');
        setFeedback('');

        if (!siteForm.name.trim()) {
            setError('Le nom du site est obligatoire.');
            return;
        }

        setCreateSiteLoading(true);

        try {
            const response = await sitesZonesService.createSite({
                name: siteForm.name.trim(),
                address: siteForm.address.trim() || null,
            });

            const createdSite = response.data?.data;
            if (createdSite) {
                setSites((prev) => [...prev, createdSite].sort((a, b) => a.name.localeCompare(b.name)));
            }

            setFeedback('Site cree avec succes.');
            setSiteForm({ name: '', address: '' });
            setShowCreateSiteModal(false);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de creer le site.';
            setError(message);
        } finally {
            setCreateSiteLoading(false);
        }
    };

    const openCreateRoomModal = (site) => {
        setError('');
        setFeedback('');
        setCreateZoneMode('create');
        setSelectedExistingRoomId('');
        setForm({ name: '', description: '', siteId: site.id, createInTuya: true });
        setSelectedSiteForModal(site);
        setShowCreateRoomModal(true);
    };

    const handleDeleteSite = async (site) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer le site "${site.name}" ? Les pieces associees seront detachees de ce site.`)) {
            return;
        }

        setError('');
        setFeedback('');
        setDeletingSiteId(site.id);

        try {
            await sitesZonesService.deleteSite(site.id);
            setSites((prev) => prev.filter((s) => s.id !== site.id));
            setShowCreateRoomModal(false);
            setSelectedSiteForModal(null);
            setFeedback(`Site "${site.name}" supprime avec succes.`);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de supprimer ce site.';
            setError(message);
        } finally {
            setDeletingSiteId(null);
        }
    };

    const handleAttachExistingZone = async (event) => {
        event.preventDefault();
        setError('');
        setFeedback('');

        if (!selectedExistingRoomId) {
            setError('Selectionnez une piece existante a affecter.');
            return;
        }

        if (form.siteId === '') {
            setError('Le site cible est obligatoire.');
            return;
        }

        const roomToAttach = rooms.find((room) => room.id === Number(selectedExistingRoomId));
        if (!roomToAttach) {
            setError('Piece introuvable.');
            return;
        }

        setAttachZoneLoading(true);

        try {
            const response = await sitesZonesService.updateRoom(roomToAttach.id, {
                siteId: Number(form.siteId),
            });

            const updatedRoom = response.data?.data;
            if (updatedRoom) {
                setRooms((prev) => prev.map((item) => (item.id === updatedRoom.id ? updatedRoom : item)));
            }

            setFeedback(`Piece ${roomToAttach.name} affectee au site.`);
            setShowCreateRoomModal(false);
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible d affecter cette piece.';
            setError(message);
        } finally {
            setAttachZoneLoading(false);
        }
    };

    return (
        <section className="page-shell">
            <header className="page-header">
                <div className="page-header-row">
                    <h1>Sites & Pieces</h1>
                    <div className="tuya-top-counter">Pieces Tuya: {tuyaRooms.length}</div>
                </div>
                <p>Gestion de l organisation multi-sites</p>
            </header>

            <div className="sites-zones-topbar">
                <div className="sites-zones-stat-grid">
                    <article className="sz-stat-card">
                        <p className="sz-stat-label">Sites</p>
                        <p className="sz-stat-value">{sites.length}</p>
                    </article>
                    <article className="sz-stat-card">
                        <p className="sz-stat-label">Pieces</p>
                        <p className="sz-stat-value">{rooms.length}</p>
                    </article>
                    <article className="sz-stat-card">
                        <p className="sz-stat-label">Equipements</p>
                        <p className="sz-stat-value">{associatedDeviceIds.length}</p>
                    </article>
                    <article className="sz-stat-card">
                        <p className="sz-stat-label">En fonctionnement</p>
                        <p className="sz-stat-value">{onlineAssociatedCount}</p>
                    </article>
                </div>

                <div className="sites-zones-top-actions">
                    <button
                        type="button"
                        className="refresh-button"
                        onClick={() => setShowCreateSiteModal(true)}
                    >
                        + Ajouter un site
                    </button>
                    <button
                        type="button"
                        className="refresh-button"
                        onClick={async () => {
                            setError('');
                            setFeedback('');
                            await loadRoomsFromTuya();
                            await Promise.all([loadSites(), loadRooms(), loadDevices()]);
                        }}
                        disabled={loadingSites || loadingRooms || loadingDevices}
                    >
                        {(loadingSites || loadingRooms || loadingDevices) ? 'Chargement...' : 'Rafraichir'}
                    </button>
                </div>
            </div>

            <div className="sites-zones-layout">
                <article className="panel sites-zones-rooms-panel">
                    {loadingSites && <p className="tuya-hint">Chargement des sites...</p>}
                    {loadingRooms && <p className="tuya-hint">Chargement des pieces...</p>}

                    {!loadingSites && sites.length === 0 && (
                        <p className="tuya-hint">Aucun site pour l instant. Creez un site puis affectez vos zones.</p>
                    )}

                    {!loadingRooms && rooms.length === 0 && (
                        <p className="tuya-hint">Aucune piece pour l instant. Creez-en une pour commencer.</p>
                    )}

                    {!loadingSites && sites.length > 0 && (
                        <div className="sites-list-stack">
                            {sites.map((site) => {
                                const siteRooms = roomsBySite.get(site.id) || [];
                                const siteDeviceIds = Array.from(
                                    new Set(siteRooms.flatMap((room) => (Array.isArray(room.deviceIds) ? room.deviceIds : [])))
                                );
                                const siteOnlineCount = siteDeviceIds.reduce((count, deviceId) => {
                                    const device = devicesById.get(deviceId);
                                    return count + (device?.online ? 1 : 0);
                                }, 0);

                                return (
                                    <section key={site.id} className="site-group-card">
                                        <div className="sites-main-card-head">
                                            <div>
                                                <h2>{site.name}</h2>
                                                <p>{site.address || 'Adresse non renseignee'}</p>
                                            </div>
                                            <button
                                                type="button"
                                                className="site-edit-btn"
                                                onClick={() => openCreateRoomModal(site)}
                                            >
                                                Parametres
                                            </button>
                                        </div>

                                        <div className="site-kpi-row">
                                            <article className="site-kpi-box">
                                                <p>Zones</p>
                                                <strong>{siteRooms.length}</strong>
                                            </article>
                                            <article className="site-kpi-box">
                                                <p>Equipements</p>
                                                <strong>{siteDeviceIds.length}</strong>
                                            </article>
                                            <article className="site-kpi-box">
                                                <p>En ligne</p>
                                                <strong>{siteOnlineCount}</strong>
                                            </article>
                                        </div>

                                        <div className="zones-section-head">
                                            <h3>Pieces ({siteRooms.length})</h3>
                                        </div>

                                        {siteRooms.length === 0 && (
                                            <p className="tuya-hint">Aucune piece affectee a ce site.</p>
                                        )}

                                        {siteRooms.length > 0 && (
                                            <div className="rooms-grid">
                                                {siteRooms.map((room) => {
                                                    const selectedDeviceIds = Array.isArray(room.deviceIds) ? room.deviceIds : [];
                                                    const busy = savingRoomId === room.id;

                                                    return (
                                                        <article key={room.id} className="room-card">
                                                            <div className="room-card-head">
                                                                <div>
                                                                    <h3>{room.name}</h3>
                                                                    <p>{room.description || 'Zone technique'}</p>
                                                                </div>
                                                                <div className="room-card-head-actions">
                                                                    <p className={`room-sync-badge ${room.syncStatus || 'local'}`}>{getRoomSyncLabel(room)}</p>
                                                                    <button
                                                                        type="button"
                                                                        className="room-settings-btn"
                                                                        onClick={() => {
                                                                            setSelectedRoomForSettings(room);
                                                                            setShowRoomSettingsModal(true);
                                                                        }}
                                                                        disabled={busy}
                                                                        aria-label="Parametres de la zone"
                                                                    >
                                                                        ⚙
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <p className="room-count">{selectedDeviceIds.length} equipement(s) affecte(s)</p>

                                                            {room.syncMessage && (
                                                                <p className="room-sync-message">{room.syncMessage}</p>
                                                            )}

                                                            {loadingDevices && <p className="tuya-hint">Chargement des equipements...</p>}

                                                            {!loadingDevices && selectedDeviceIds.length === 0 && (
                                                                <p className="tuya-hint">Aucun equipement affecte.</p>
                                                            )}

                                                            {!loadingDevices && selectedDeviceIds.length > 0 && (
                                                                <ul className="room-associated-list">
                                                                    {selectedDeviceIds.map((deviceId) => {
                                                                        const device = devicesById.get(deviceId);
                                                                        if (!device) {
                                                                            return (
                                                                                <li key={deviceId} className="room-associated-item">Equipement indisponible</li>
                                                                            );
                                                                        }

                                                                        return (
                                                                            <li key={deviceId} className="room-associated-item">
                                                                                <span>{device.name}</span>
                                                                                <small>{device.category || 'inconnu'}</small>
                                                                            </li>
                                                                        );
                                                                    })}
                                                                </ul>
                                                            )}

                                                            <div className="room-card-footer-actions">
                                                                <button
                                                                    type="button"
                                                                    className="room-add-device-btn"
                                                                    onClick={() => openAddEquipmentModal(room)}
                                                                    disabled={busy || loadingDevices || devices.length === 0}
                                                                >
                                                                    + Ajouter un equipement
                                                                </button>
                                                            </div>
                                                        </article>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </section>
                                );
                            })}
                        </div>
                    )}

                    {!loadingRooms && roomsWithoutSite.length > 0 && (
                        <section className="site-group-card site-group-card-unassigned">
                            <div className="sites-main-card-head">
                                <div>
                                    <h2>Sans site</h2>
                                    <p>Zones non affectees</p>
                                </div>
                            </div>
                            <div className="rooms-grid">
                                {roomsWithoutSite.map((room) => {
                                    const selectedDeviceIds = Array.isArray(room.deviceIds) ? room.deviceIds : [];
                                    const busy = savingRoomId === room.id;

                                    return (
                                        <article key={room.id} className="room-card">
                                            <div className="room-card-head">
                                                <div>
                                                    <h3>{room.name}</h3>
                                                    <p>{room.description || 'Piece technique'}</p>
                                                </div>
                                                <div className="room-card-head-actions">
                                                    <p className={`room-sync-badge ${room.syncStatus || 'local'}`}>{getRoomSyncLabel(room)}</p>
                                                    <button
                                                        type="button"
                                                        className="room-settings-btn"
                                                        onClick={() => {
                                                            setSelectedRoomForSettings(room);
                                                            setShowRoomSettingsModal(true);
                                                        }}
                                                        disabled={busy}
                                                        aria-label="Parametres de la zone"
                                                    >
                                                        ⚙
                                                    </button>
                                                </div>
                                            </div>

                                            <p className="room-count">{selectedDeviceIds.length} equipement(s) affecte(s)</p>

                                            {loadingDevices && <p className="tuya-hint">Chargement des equipements...</p>}

                                            {!loadingDevices && selectedDeviceIds.length === 0 && (
                                                <p className="tuya-hint">Aucun equipement affecte.</p>
                                            )}

                                            {!loadingDevices && selectedDeviceIds.length > 0 && (
                                                <ul className="room-associated-list">
                                                    {selectedDeviceIds.map((deviceId) => {
                                                        const device = devicesById.get(deviceId);
                                                        if (!device) {
                                                            return (
                                                                <li key={deviceId} className="room-associated-item">Equipement indisponible</li>
                                                            );
                                                        }

                                                        return (
                                                            <li key={deviceId} className="room-associated-item">
                                                                <span>{device.name}</span>
                                                                <small>{device.category || 'inconnu'}</small>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            )}

                                            <div className="room-card-footer-actions">
                                                <button
                                                    type="button"
                                                    className="room-add-device-btn"
                                                    onClick={() => openAddEquipmentModal(room)}
                                                    disabled={busy || loadingDevices || devices.length === 0}
                                                >
                                                    + Ajouter un equipement
                                                </button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    )}
                </article>
            </div>

            {showCreateRoomModal && (
                <div className="modal-overlay" onClick={() => {
                    setShowCreateRoomModal(false);
                    setSelectedSiteForModal(null);
                }}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>📍 Gérer les pieces du site</h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => {
                                    setShowCreateRoomModal(false);
                                    setSelectedSiteForModal(null);
                                }}
                                aria-label="Fermer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body sites-zones-form">
                            <label>
                                Site cible
                                <select
                                    value={form.siteId}
                                    onChange={(event) => setForm((prev) => ({ ...prev, siteId: event.target.value === '' ? '' : Number(event.target.value) }))}
                                    disabled
                                >
                                    <option value="">Selectionnez un site</option>
                                    {sites.map((site) => (
                                        <option key={site.id} value={site.id}>{site.name}</option>
                                    ))}
                                </select>
                            </label>

                            <div className="zone-mode-switch">
                                <button
                                    type="button"
                                    className={`zone-mode-btn ${createZoneMode === 'existing' ? 'active' : ''}`}
                                    onClick={() => setCreateZoneMode('existing')}
                                >
                                    Selectionner une piece existante
                                </button>
                                <button
                                    type="button"
                                    className={`zone-mode-btn ${createZoneMode === 'create' ? 'active' : ''}`}
                                    onClick={() => setCreateZoneMode('create')}
                                >
                                    Creer une nouvelle piece
                                </button>
                            </div>

                            {createZoneMode === 'existing' && (
                                <form onSubmit={handleAttachExistingZone} className="sites-zones-form-inner">
                                    <label>
                                        Piece existante
                                        <select
                                            value={selectedExistingRoomId}
                                            onChange={(event) => setSelectedExistingRoomId(event.target.value)}
                                        >
                                            <option value="">Selectionnez une piece</option>
                                            {existingZonesForAttach.map((room) => (
                                                <option key={room.id} value={room.id}>
                                                    {room.name}{room.siteName ? ` (${room.siteName})` : ' (sans site)'}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    {error && <div className="tuya-feedback error"><p>{error}</p></div>}
                                    {feedback && <div className="tuya-feedback success"><p>{feedback}</p></div>}

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => {
                                                setShowCreateRoomModal(false);
                                                setSelectedSiteForModal(null);
                                            }}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={attachZoneLoading}
                                        >
                                            {attachZoneLoading ? 'Affectation...' : 'Affecter la piece'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            <div className="site-zone-management">
                                <h3>Retirer des pieces du site</h3>
                                {currentSiteRoomsForModal.length === 0 && (
                                    <p className="tuya-hint">Aucune piece affectee a ce site.</p>
                                )}
                                {currentSiteRoomsForModal.length > 0 && (
                                    <div className="site-zone-management-list">
                                        {currentSiteRoomsForModal.map((room) => (
                                            <div key={`manage-${room.id}`} className="site-zone-management-item">
                                                <span>{room.name}</span>
                                                <button
                                                    type="button"
                                                    className="btn-danger"
                                                    onClick={() => handleDetachRoomFromSite(room)}
                                                    disabled={savingRoomId === room.id}
                                                >
                                                    {savingRoomId === room.id ? '...' : 'Retirer'}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {selectedSiteForModal && (
                                <div className="site-zone-management" style={{ borderTop: '1px solid #ddd', marginTop: '2rem', paddingTop: '2rem' }}>
                                    <h3>Supprimer ce site</h3>
                                    <p className="tuya-hint">Cette action supprimera le site et detachera toutes les pieces associees.</p>
                                    <div className="site-zone-management-list">
                                        <button
                                            type="button"
                                            className="btn-danger"
                                            onClick={() => handleDeleteSite(selectedSiteForModal)}
                                            disabled={deletingSiteId === selectedSiteForModal.id}
                                            style={{ width: '100%', marginTop: '1rem' }}
                                        >
                                            {deletingSiteId === selectedSiteForModal.id ? 'Suppression en cours...' : '🗑️ Supprimer le site'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {createZoneMode === 'create' && (
                                <form className="sites-zones-form-inner" onSubmit={handleCreateRoom}>
                                    <label>
                                        Nom de la piece
                                        <input
                                            type="text"
                                            value={form.name}
                                            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                                            placeholder="Ex: Bureau R+1"
                                            maxLength={120}
                                            autoFocus
                                        />
                                    </label>

                                    <label>
                                        Description (optionnel)
                                        <textarea
                                            value={form.description}
                                            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                            placeholder="Contexte thermique ou type de piece"
                                            maxLength={500}
                                            rows={4}
                                        />
                                    </label>

                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={Boolean(form.createInTuya)}
                                            onChange={(event) => setForm((prev) => ({ ...prev, createInTuya: event.target.checked }))}
                                        />
                                        Creer aussi la piece dans Tuya
                                    </label>

                                    {error && <div className="tuya-feedback error"><p>{error}</p></div>}
                                    {feedback && <div className="tuya-feedback success"><p>{feedback}</p></div>}

                                    <div className="modal-footer">
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => {
                                                setShowCreateRoomModal(false);
                                                setSelectedSiteForModal(null);
                                            }}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={createLoading}
                                        >
                                            {createLoading ? 'Création...' : 'Créer la piece'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showCreateSiteModal && (
                <div className="modal-overlay" onClick={() => setShowCreateSiteModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Creer un site</h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setShowCreateSiteModal(false)}
                                aria-label="Fermer"
                            >
                                ✕
                            </button>
                        </div>

                        <form className="modal-body sites-zones-form" onSubmit={handleCreateSite}>
                            <label>
                                Nom du site
                                <input
                                    type="text"
                                    value={siteForm.name}
                                    onChange={(event) => setSiteForm((prev) => ({ ...prev, name: event.target.value }))}
                                    placeholder="Ex: Mairie Centre-Ville"
                                    maxLength={120}
                                    autoFocus
                                />
                            </label>

                            <label>
                                Adresse (optionnel)
                                <textarea
                                    value={siteForm.address}
                                    onChange={(event) => setSiteForm((prev) => ({ ...prev, address: event.target.value }))}
                                    placeholder="Ex: 12 Place de la Republique, 75000 Paris"
                                    maxLength={500}
                                    rows={3}
                                />
                            </label>

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowCreateSiteModal(false)}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={createSiteLoading}
                                >
                                    {createSiteLoading ? 'Creation...' : 'Creer le site'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showAddEquipmentModal && selectedRoomForEquipment && (
                <div className="modal-overlay" onClick={() => setShowAddEquipmentModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Ajouter un equipement</h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setShowAddEquipmentModal(false)}
                                aria-label="Fermer"
                            >
                                ✕
                            </button>
                        </div>

                        <form className="modal-body sites-zones-form" onSubmit={handleAddEquipmentToRoom}>
                            <p>Piece cible: <strong>{selectedRoomForEquipment.name}</strong></p>

                            <label>
                                Equipement disponible
                                <select
                                    value={selectedDeviceToAdd}
                                    onChange={(event) => setSelectedDeviceToAdd(event.target.value)}
                                >
                                    <option value="">Selectionnez un equipement</option>
                                    {availableDevicesForModal.map((device) => (
                                        <option key={device.id} value={device.id}>
                                            {device.name}{device.category ? ` (${device.category})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {availableDevicesForModal.length === 0 && (
                                <p className="tuya-hint">Aucun equipement disponible: ils sont deja affectes a une zone.</p>
                            )}

                            <div className="modal-footer">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={() => setShowAddEquipmentModal(false)}
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={savingRoomId === selectedRoomForEquipment.id || availableDevicesForModal.length === 0}
                                >
                                    {savingRoomId === selectedRoomForEquipment.id ? 'Ajout...' : 'Ajouter'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showRoomSettingsModal && selectedRoomForSettings && (
                <div className="modal-overlay" onClick={() => setShowRoomSettingsModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Parametres piece</h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setShowRoomSettingsModal(false)}
                                aria-label="Fermer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            {editingRoomId === selectedRoomForSettings.id ? (
                                <form onSubmit={(e) => { e.preventDefault(); handleUpdateRoomName(); }}>
                                    <div className="form-group">
                                        <label>Nom de la piece</label>
                                        <input
                                            type="text"
                                            value={editingRoomName}
                                            onChange={(e) => setEditingRoomName(e.target.value)}
                                            placeholder="Entrez le nouveau nom"
                                            disabled={savingRoomId === selectedRoomForSettings.id}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="modal-footer" style={{ paddingInline: 0 }}>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => {
                                                setEditingRoomId(null);
                                                setEditingRoomName('');
                                            }}
                                            disabled={savingRoomId === selectedRoomForSettings.id}
                                        >
                                            Annuler
                                        </button>
                                        <button
                                            type="submit"
                                            className="btn-primary"
                                            disabled={savingRoomId === selectedRoomForSettings.id}
                                        >
                                            {savingRoomId === selectedRoomForSettings.id ? 'Enregistrement...' : 'Enregistrer'}
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <>
                                    <p>Piece: <strong>{selectedRoomForSettings.name}</strong></p>
                                    <div className="modal-footer" style={{ paddingInline: 0 }}>
                                        <button
                                            type="button"
                                            className="btn-secondary"
                                            onClick={() => setShowRoomSettingsModal(false)}
                                        >
                                            Fermer
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            onClick={() => {
                                                setEditingRoomId(selectedRoomForSettings.id);
                                                setEditingRoomName(selectedRoomForSettings.name);
                                            }}
                                            disabled={savingRoomId === selectedRoomForSettings.id}
                                        >
                                            Modifier le nom
                                        </button>
                                        <button
                                            type="button"
                                            className="btn-danger"
                                            onClick={async () => {
                                                await handleDeleteRoom(selectedRoomForSettings);
                                                setShowRoomSettingsModal(false);
                                                setSelectedRoomForSettings(null);
                                            }}
                                            disabled={savingRoomId === selectedRoomForSettings.id}
                                        >
                                            {savingRoomId === selectedRoomForSettings.id ? 'Suppression...' : 'Supprimer la zone'}
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
