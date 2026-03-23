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
    const [editingDevice, setEditingDevice] = useState(null);
    const [showCategoryForm, setShowCategoryForm] = useState(false);
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

    const getDevicesByCategory = (categoryId) => {
        return devices.filter(device => {
            if (categoryId === null) {
                return !device.category_id;
            }
            return device.category_id === categoryId;
        });
    };

    useEffect(() => {
        loadDevices();
        loadCategories();
    }, []);

    const categoriesList = Array.isArray(categories) ? categories : [];

    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>Equipements</h1>
                <p>Vue d'ensemble de tous vos équipements organisés par catégories.</p>
            </header>

            <div className="equipments-full-width">
                {/* Header avec bouton refresh */}
                <div className="equipments-top-bar">
                    <button type="button" className="refresh-button" onClick={loadDevices} disabled={loading}>
                        {loading ? 'Chargement...' : 'Rafraichir'}
                    </button>
                    <button
                        type="button"
                        className="btn-primary-outline"
                        onClick={() => setShowCategoryForm(!showCategoryForm)}
                    >
                        {showCategoryForm ? '✕ Annuler' : '+ Nouvelle catégorie'}
                    </button>
                </div>

                {error && (
                    <div className="tuya-feedback error">
                        <p>{error}</p>
                        <p>
                            Verifiez la connexion dans <Link to="/parametres">Parametres</Link>.
                        </p>
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

                {!loading && !error && devices.length === 0 && (
                    <p className="tuya-hint">
                        Aucun equipement trouve. Verifiez votre projet Tuya ou reconnectez votre API dans
                        {' '}
                        <Link to="/parametres">Parametres</Link>.
                    </p>
                )}

                {devices.length > 0 && (
                    <div className="equipments-by-category">
                        {/* Catégories avec équipements */}
                        {categoriesList.map((category) => {
                            const categoryDevices = getDevicesByCategory(category.id);
                            if (categoryDevices.length === 0) return null;

                            return (
                                <div key={category.id} className="category-section">
                                    <div className="category-header">
                                        <div className="category-title">
                                            <span style={{ fontSize: '1.4em' }}>{category.icon}</span>
                                            <h2>{category.name}</h2>
                                            {category.description && (
                                                <p className="category-description">{category.description}</p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            className="btn-delete-category"
                                            onClick={() => handleDeleteCategory(category.id)}
                                            title="Supprimer la catégorie"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                    <div className="equipments-grid">
                                        {categoryDevices.map((device) => (
                                            <article key={device.id} className="equipment-card">
                                                <div className="equipment-head">
                                                    <h3>{device.name}</h3>
                                                    <span className={`tuya-status ${device.online ? 'connected' : 'disconnected'}`}>
                                                        {device.online ? 'En ligne' : 'Hors ligne'}
                                                    </span>
                                                </div>

                                                <dl className="equipment-meta">
                                                    <div>
                                                        <dt>ID</dt>
                                                        <dd>{device.id}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Modele</dt>
                                                        <dd>{device.model || '-'}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Etat</dt>
                                                        <dd>
                                                            {device.powerOn === null ? (
                                                                <span className="device-state unknown">
                                                                    <span className="status-icon">⚠️</span>
                                                                    Information non disponible
                                                                </span>
                                                            ) : device.powerOn ? (
                                                                <span className="device-state on">
                                                                    <span className="status-icon">🟢</span>
                                                                    Allumé
                                                                </span>
                                                            ) : (
                                                                <span className="device-state off">
                                                                    <span className="status-icon">⚫</span>
                                                                    Éteint
                                                                </span>
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt>IP</dt>
                                                        <dd>{device.ip || '-'}</dd>
                                                    </div>
                                                </dl>

                                                <div className="equipment-footer">
                                                    <button
                                                        type="button"
                                                        className="btn-edit"
                                                        onClick={() => setEditingDevice(device)}
                                                    >
                                                        Modifier
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}

                        {/* Équipements sans catégorie */}
                        {(() => {
                            const unCategorizedDevices = getDevicesByCategory(null);
                            if (unCategorizedDevices.length === 0) return null;

                            return (
                                <div className="category-section">
                                    <div className="category-header">
                                        <div className="category-title">
                                            <span style={{ fontSize: '1.4em' }}>❓</span>
                                            <h2>Sans catégorie</h2>
                                        </div>
                                    </div>
                                    <div className="equipments-grid">
                                        {unCategorizedDevices.map((device) => (
                                            <article key={device.id} className="equipment-card">
                                                <div className="equipment-head">
                                                    <h3>{device.name}</h3>
                                                    <span className={`tuya-status ${device.online ? 'connected' : 'disconnected'}`}>
                                                        {device.online ? 'En ligne' : 'Hors ligne'}
                                                    </span>
                                                </div>

                                                <dl className="equipment-meta">
                                                    <div>
                                                        <dt>ID</dt>
                                                        <dd>{device.id}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Modele</dt>
                                                        <dd>{device.model || '-'}</dd>
                                                    </div>
                                                    <div>
                                                        <dt>Etat</dt>
                                                        <dd>
                                                            {device.powerOn === null ? (
                                                                <span className="device-state unknown">
                                                                    <span className="status-icon">⚠️</span>
                                                                    Information non disponible
                                                                </span>
                                                            ) : device.powerOn ? (
                                                                <span className="device-state on">
                                                                    <span className="status-icon">🟢</span>
                                                                    Allumé
                                                                </span>
                                                            ) : (
                                                                <span className="device-state off">
                                                                    <span className="status-icon">⚫</span>
                                                                    Éteint
                                                                </span>
                                                            )}
                                                        </dd>
                                                    </div>
                                                    <div>
                                                        <dt>IP</dt>
                                                        <dd>{device.ip || '-'}</dd>
                                                    </div>
                                                </dl>

                                                <div className="equipment-footer">
                                                    <button
                                                        type="button"
                                                        className="btn-edit"
                                                        onClick={() => setEditingDevice(device)}
                                                    >
                                                        Modifier
                                                    </button>
                                                </div>
                                            </article>
                                        ))}
                                    </div>
                                </div>
                            );
                        })()}
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
                />
            )}
        </section>
    );
}

