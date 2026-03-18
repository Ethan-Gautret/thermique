import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import tuyaService from '../../services/tuya';

export default function EquipementsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [devices, setDevices] = useState([]);

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

    useEffect(() => {
        loadDevices();
    }, []);

    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>Equipements</h1>
                <p>Liste des equipements relies a votre connexion API Tuya.</p>
            </header>

            <article className="panel equipments-panel">
                <div className="panel-head">
                    <h2>Equipements connectes</h2>
                    <button type="button" className="refresh-button" onClick={loadDevices} disabled={loading}>
                        {loading ? 'Chargement...' : 'Rafraichir'}
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

                {!loading && !error && devices.length === 0 && (
                    <p className="tuya-hint">
                        Aucun equipement trouve. Verifiez votre projet Tuya ou reconnectez votre API dans
                        {' '}
                        <Link to="/parametres">Parametres</Link>.
                    </p>
                )}

                {devices.length > 0 && (
                    <div className="equipments-grid">
                        {devices.map((device) => (
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
                                        <dt>Categorie</dt>
                                        <dd>{device.category}</dd>
                                    </div>
                                    <div>
                                        <dt>Modele</dt>
                                        <dd>{device.model || '-'}</dd>
                                    </div>
                                    <div>
                                        <dt>Produit</dt>
                                        <dd>{device.productName || '-'}</dd>
                                    </div>
                                    <div>
                                        <dt>IP</dt>
                                        <dd>{device.ip || '-'}</dd>
                                    </div>
                                </dl>
                            </article>
                        ))}
                    </div>
                )}
            </article>
        </section>
    );
}
