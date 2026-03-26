import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import tuyaService from '../../services/tuya';
import categoryService from '../../services/category';
import EquipmentEditor from '../EquipmentEditor';
import '../../styles/modal.css';

export default function EquipementsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [controllingDeviceId, setControllingDeviceId] = useState(null);
    const [editingDevice, setEditingDevice] = useState(null);
    const [infoDevice, setInfoDevice] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [siteFilter, setSiteFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [powerFilter, setPowerFilter] = useState('all');
    const [newCategory, setNewCategory] = useState({
        name: '',
        description: '',
        icon: '📁',
        color: '#6366f1'
    });

    const loadDevices = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await tuyaService.getDevices();
            setDevices(response.data?.data || []);
        } catch (err) {
            const apiMessage = err.response?.data?.message;
            setError(apiMessage || 'Impossible de charger les equipements Tuya.');
            setDevices([]);
        } finally {
            setLoading(false);
        }
    };

    const loadCategories = async () => {
        try {
            const response = await categoryService.getCategories();
            const payload = response?.data?.data ?? response?.data ?? [];
            setCategories(Array.isArray(payload) ? payload : []);
        } catch (err) {
            console.error('Error loading categories:', err);
            setCategories([]);
        }
    };

    const handleSaveDeviceCategory = async (deviceId, categoryId) => {
        try {
            await tuyaService.updateDeviceCategory(deviceId, categoryId);
            // Recharger les appareils pour mettre à jour la liste
            await loadDevices();
        } catch (err) {
            console.error('Error saving device category:', err);
            throw err;
        }
    };

    const handleDeleteDevice = async (deviceId) => {
        if (!window.confirm('Supprimer cet équipement du site et de la base locale ?')) {
            return;
        }

        try {
            await tuyaService.deleteDevice(deviceId);
            await loadDevices();
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de supprimer cet équipement.';
            setError(message);
        }
    };

    const getPowerCommandCandidates = (device) => {
        const knownPowerCommand = String(device?.powerCommand || '').trim();
        if (knownPowerCommand !== '') {
            return [knownPowerCommand];
        }

        const properties = Array.isArray(device?.properties) ? device.properties : [];
        const propertyCodes = properties
            .map((property) => String(property?.code || '').toLowerCase())
            .filter(Boolean);

        const detected = [];

        if (propertyCodes.includes('switch_1')) {
            detected.push('switch_1');
        }

        if (propertyCodes.includes('switch')) {
            detected.push('switch');
        }

        if (propertyCodes.includes('switch_led')) {
            detected.push('switch_led');
        }

        const fallback = ['switch_1', 'switch', 'switch_led'];
        return [...new Set([...detected, ...fallback])];
    };

    const sendPowerCommand = async (device, nextPowerOn) => {
        const deviceId = device?.id;

        if (!deviceId) {
            throw new Error('Identifiant appareil manquant.');
        }

        const commandCandidates = getPowerCommandCandidates(device);
        let lastError = null;

        for (const command of commandCandidates) {
            try {
                const response = await tuyaService.controlDevice(deviceId, command, nextPowerOn);
                const payload = response?.data?.data ?? response?.data;

                if (payload?.applied === false) {
                    throw new Error('La commande a ete envoyee mais l\'etat reel n\'a pas change.');
                }

                return true;
            } catch (err) {
                lastError = err;

                // If the backend explicitly rejects the command, don't spam other attempts.
                if (err?.response?.status === 422) {
                    break;
                }
            }
        }

        throw lastError || new Error('Commande d\'alimentation indisponible pour cet equipement.');
    };

    const handleTogglePower = async (device) => {
        if (!device?.id) {
            return;
        }

        if (!device.online) {
            setError('Impossible de controler un equipement hors ligne.');
            return;
        }

        const nextPowerOn = !(device.powerOn === true);

        setControllingDeviceId(device.id);
        setError('');

        try {
            await sendPowerCommand(device, nextPowerOn);
            await loadDevices();
        } catch (err) {
            const message = err.response?.data?.message || 'Impossible de changer l\'etat de cet equipement.';
            setError(message);
        } finally {
            setControllingDeviceId(null);
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            await categoryService.createCategory(
                newCategory.name,
                newCategory.description,
                newCategory.icon,
                newCategory.color
            );
            setNewCategory({ name: '', description: '', icon: '📁', color: '#6366f1' });
            setShowCategoryForm(false);
            await loadCategories();
        } catch (err) {
            console.error('Error creating category:', err);
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        if (!window.confirm('Êtes-vous sûr de vouloir supprimer cette catégorie?')) {
            return;
        }
        try {
            await categoryService.deleteCategory(categoryId);
            await loadCategories();
        } catch (err) {
            console.error('Error deleting category:', err);
        }
    };

    useEffect(() => {
        loadDevices();
        loadCategories();
    }, []);

    const categoriesList = Array.isArray(categories) ? categories : [];
    const categoriesById = categoriesList.reduce((acc, category) => {
        acc[category.id] = category;
        return acc;
    }, {});

    const filteredDevices = devices.filter((device) => {
        const normalizedSearch = searchTerm.trim().toLowerCase();
        const matchesSearch = normalizedSearch === ''
            || String(device.name || '').toLowerCase().includes(normalizedSearch)
            || String(device.model || '').toLowerCase().includes(normalizedSearch)
            || String(device.ip || '').toLowerCase().includes(normalizedSearch);

        const matchesSite = siteFilter === 'all'
            || (siteFilter === 'uncategorized' && !device.category_id)
            || String(device.category_id) === siteFilter;

        const matchesStatus = statusFilter === 'all'
            || (statusFilter === 'online' && device.online)
            || (statusFilter === 'offline' && !device.online);

        const matchesPower = powerFilter === 'all'
            || (powerFilter === 'on' && device.powerOn === true)
            || (powerFilter === 'off' && device.powerOn === false)
            || (powerFilter === 'unknown' && device.powerOn === null);

        return matchesSearch && matchesSite && matchesStatus && matchesPower;
    });

    const metricDefinitions = [
        {
            key: 'temperature',
            label: 'Temperature',
            unit: '°C',
            icon: '🌡️',
            codes: ['va_temperature', 'temp_current', 'temperature', 'cur_temperature', 'cur_temp'],
        },
        {
            key: 'humidity',
            label: 'Humidite',
            unit: '%',
            icon: '💧',
            codes: ['va_humidity', 'humidity', 'humid', 'cur_humidity'],
        },
        {
            key: 'co2',
            label: 'CO2',
            unit: 'ppm',
            icon: '🫧',
            codes: ['co2', 'carbon_dioxide'],
        },
        {
            key: 'illuminance',
            label: 'Luminosite',
            unit: 'lx',
            icon: '💡',
            codes: ['illuminance', 'bright', 'lux'],
        },
    ];

    const normalizeMetricValue = (definition, code, rawValue) => {
        const numericValue = Number(rawValue);

        if (!Number.isFinite(numericValue)) {
            return String(rawValue ?? '-');
        }

        if (definition.key === 'temperature') {
            const needsDecimalScale = code.includes('va_temperature') || Math.abs(numericValue) > 70;
            const value = needsDecimalScale ? numericValue / 10 : numericValue;
            return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${definition.unit}`;
        }

        if (definition.key === 'humidity') {
            const value = numericValue > 100 ? numericValue / 10 : numericValue;
            return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} ${definition.unit}`;
        }

        return `${numericValue} ${definition.unit}`;
    };

    const getPrimaryMetrics = (device) => {
        const properties = Array.isArray(device.properties) ? device.properties : [];

        return metricDefinitions
            .map((definition) => {
                const match = properties.find((property) => {
                    const code = String(property?.code || '').toLowerCase();
                    return definition.codes.some((pattern) => code.includes(pattern));
                });

                if (!match) {
                    return null;
                }

                const code = String(match.code || '').toLowerCase();
                return {
                    key: definition.key,
                    label: definition.label,
                    icon: definition.icon,
                    value: normalizeMetricValue(definition, code, match.value),
                };
            })
            .filter(Boolean);
    };

    const renderDeviceCard = (device) => {
        const isControlling = controllingDeviceId === device.id;
        const hasPowerControl = device.powerOn !== null;
        const canControl = device.online && hasPowerControl && !isControlling;
        const primaryMetrics = getPrimaryMetrics(device);
        const rawProperties = Array.isArray(device.properties) ? device.properties : [];
        const categoryName = device.category_id && categoriesById[device.category_id]
            ? categoriesById[device.category_id].name
            : 'Sans catégorie';
        const modeProperty = rawProperties.find((property) => String(property?.code || '').toLowerCase().includes('mode'));
        const modeValue = modeProperty?.value ? String(modeProperty.value) : '-';
        const accentMetric = primaryMetrics.find((metric) => metric.key === 'temperature') || primaryMetrics[0];
        const powerLabel = device.powerOn === null ? 'N/A' : (device.powerOn ? 'ON' : 'OFF');

        return (
            <article key={device.id} className="equip-card-modern">
                <div className="equip-card-head">
                    <div className="equip-title-line">
                        <span className="equip-icon">{accentMetric?.icon || '⚙️'}</span>
                        <div>
                            <h3>{device.name}</h3>
                            <p>{categoryName}</p>
                        </div>
                    </div>
                    <span className={`equip-status-badge ${device.online ? 'online' : 'offline'}`}>
                        {device.online ? 'online' : 'offline'}
                    </span>
                </div>

                <dl className="equip-metrics-block">
                    {primaryMetrics.length > 0 ? (
                        primaryMetrics.slice(0, 2).map((metric) => (
                            <div key={metric.key}>
                                <dt>{metric.label}</dt>
                                <dd>{metric.value}</dd>
                            </div>
                        ))
                    ) : (
                        <div>
                            <dt>Mesures</dt>
                            <dd>-</dd>
                        </div>
                    )}
                    <div>
                        <dt>Mode</dt>
                        <dd>{modeValue}</dd>
                    </div>
                </dl>

                <div className="equip-actions-row">
                    <button
                        type="button"
                        className={`equip-power-btn ${device.powerOn ? 'on' : 'off'}`}
                        onClick={() => handleTogglePower(device)}
                        disabled={!canControl}
                        title={
                            !device.online
                                ? 'Appareil hors ligne'
                                : (!hasPowerControl ? 'Equipement non pilotable (pas de commande power detectee)' : 'Controler la mise sous tension')
                        }
                    >
                        {isControlling ? 'Envoi...' : `⏻ ${powerLabel}`}
                    </button>
                    <button
                        type="button"
                        className="btn-info-device"
                        onClick={() => setInfoDevice(device)}
                        title="Voir toutes les informations"
                        aria-label="Voir toutes les informations"
                    >
                        i
                    </button>
                    <button
                        type="button"
                        className="btn-edit"
                        onClick={() => setEditingDevice(device)}
                    >
                        ⚙
                    </button>
                </div>

                <div className="equip-footer-line">
                    <span>{device.model || 'Modele inconnu'}</span>
                    <strong>{device.ip || '-'}</strong>
                </div>
            </article>
        );
    };

    return (
        <section className="page-shell">
            <header className="page-header equip-page-head">
                <div>
                    <h1>Équipements</h1>
                    <p>Gestion et pilotage en temps reel</p>
                </div>
                <div className="equip-page-actions">
                    <button type="button" className="refresh-button" onClick={loadDevices} disabled={loading}>
                        {loading ? 'Synchronisation...' : '⟳ Synchroniser Smart Life'}
                    </button>
                    <button
                        type="button"
                        className="btn-primary-outline"
                        onClick={() => setShowCategoryForm(!showCategoryForm)}
                    >
                        {showCategoryForm ? '✕ Annuler' : '+ Nouvelle catégorie'}
                    </button>
                </div>
            </header>

            <div className="equipments-full-width">
                <div className="equip-filter-bar">
                    <div className="equip-filter-item">
                        <label htmlFor="equip-search">Recherche</label>
                        <input
                            id="equip-search"
                            type="text"
                            placeholder="Nom équipement..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="equip-filter-item">
                        <label htmlFor="equip-site-filter">Site</label>
                        <select
                            id="equip-site-filter"
                            value={siteFilter}
                            onChange={(e) => setSiteFilter(e.target.value)}
                        >
                            <option value="all">Tous les sites</option>
                            {categoriesList.map((category) => (
                                <option key={category.id} value={String(category.id)}>
                                    {category.name}
                                </option>
                            ))}
                            <option value="uncategorized">Sans catégorie</option>
                        </select>
                    </div>
                    <div className="equip-filter-item">
                        <label htmlFor="equip-status-filter">Statut</label>
                        <select
                            id="equip-status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">Tous</option>
                            <option value="online">Online</option>
                            <option value="offline">Offline</option>
                        </select>
                    </div>
                    <div className="equip-filter-item">
                        <label htmlFor="equip-power-filter">Alimentation</label>
                        <select
                            id="equip-power-filter"
                            value={powerFilter}
                            onChange={(e) => setPowerFilter(e.target.value)}
                        >
                            <option value="all">Tous</option>
                            <option value="on">ON</option>
                            <option value="off">OFF</option>
                            <option value="unknown">Inconnu</option>
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="tuya-feedback error">
                        <p>{error}</p>
                        {String(error).toLowerCase().includes('connexion') && (
                            <p>
                                Verifiez la connexion dans <Link to="/parametres">Parametres</Link>.
                            </p>
                        )}
                    </div>
                )}

                {/* Formulaire création catégorie */}
                {showCategoryForm && (
                    <div className="category-creation-panel">
                        <form onSubmit={handleCreateCategory} className="category-form-inline">
                            <input
                                type="text"
                                placeholder="Nom de la catégorie"
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                required
                                maxLength={120}
                            />
                            <textarea
                                placeholder="Description (optionnel)"
                                value={newCategory.description}
                                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                                maxLength={255}
                                rows={2}
                            />
                            <div className="form-row">
                                <input
                                    type="text"
                                    placeholder="Icône"
                                    value={newCategory.icon}
                                    onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                                    maxLength={2}
                                    style={{ flex: '0 0 60px' }}
                                />
                                <input
                                    type="color"
                                    value={newCategory.color}
                                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                                />
                            </div>
                            <button type="submit" className="btn-primary">Créer</button>
                        </form>
                    </div>
                )}

                {!loading && !error && filteredDevices.length === 0 && (
                    <p className="tuya-hint">
                        Aucun equipement trouve avec ces filtres. Verifiez votre connexion dans
                        {' '}
                        <Link to="/parametres">Parametres</Link>.
                    </p>
                )}

                {filteredDevices.length > 0 && (
                    <div className="equipments-grid equipments-grid-modern">
                        {filteredDevices.map((device) => renderDeviceCard(device))}
                    </div>
                )}

                {categoriesList.length > 0 && (
                    <div className="category-actions-row">
                        {categoriesList.map((category) => (
                            <button
                                key={category.id}
                                type="button"
                                className="btn-delete-category"
                                onClick={() => handleDeleteCategory(category.id)}
                                title={`Supprimer ${category.name}`}
                            >
                                🗑 {category.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {editingDevice && (
                <EquipmentEditor
                    device={editingDevice}
                    categories={categories}
                    loading={loading}
                    onClose={() => setEditingDevice(null)}
                    onSave={handleSaveDeviceCategory}
                    onDelete={handleDeleteDevice}
                />
            )}

            {infoDevice && (
                <div className="modal-overlay" onClick={() => setInfoDevice(null)}>
                    <div className="modal-content equipment-info-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Informations equipement</h2>
                            <button
                                type="button"
                                className="close-button"
                                onClick={() => setInfoDevice(null)}
                                aria-label="Fermer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="modal-body">
                            <dl className="equipment-full-meta">
                                <div>
                                    <dt>Nom</dt>
                                    <dd>{infoDevice.name || '-'}</dd>
                                </div>
                                <div>
                                    <dt>IP</dt>
                                    <dd>{infoDevice.ip || '-'}</dd>
                                </div>
                                <div>
                                    <dt>Modele</dt>
                                    <dd>{infoDevice.model || '-'}</dd>
                                </div>
                                <div>
                                    <dt>Produit</dt>
                                    <dd>{infoDevice.productName || '-'}</dd>
                                </div>
                                <div>
                                    <dt>Statut</dt>
                                    <dd>{infoDevice.online ? 'En ligne' : 'Hors ligne'}</dd>
                                </div>
                                <div>
                                    <dt>Alimentation</dt>
                                    <dd>
                                        {infoDevice.powerOn === null
                                            ? 'Inconnue'
                                            : (infoDevice.powerOn ? 'Allume' : 'Eteint')}
                                    </dd>
                                </div>
                            </dl>

                            <div className="equipment-full-properties">
                                <h3>Toutes les donnees capteur</h3>
                                {Array.isArray(infoDevice.properties) && infoDevice.properties.length > 0 ? (
                                    <ul>
                                        {infoDevice.properties.map((property) => (
                                            <li key={property.code}>
                                                <span>{property.name || property.code}</span>
                                                <strong>
                                                    {String(property.value ?? '-')}
                                                    {property.unit ? ` ${property.unit}` : ''}
                                                </strong>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p>Aucune donnee detaillee disponible.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

