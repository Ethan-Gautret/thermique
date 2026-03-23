import { useEffect, useState } from 'react';
import tuyaService from '../../services/tuya';

const defaultForm = {
    clientId: '',
    clientSecret: '',
    region: 'eu',
    homeId: '',
};

const regionOptions = [
    { value: 'eu', label: 'Europe (EU)' },
    { value: 'us', label: 'Etats-Unis (US)' },
    { value: 'cn', label: 'Chine (CN)' },
    { value: 'in', label: 'Inde (IN)' },
];

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [disconnecting, setDisconnecting] = useState(false);
    const [connection, setConnection] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [form, setForm] = useState(defaultForm);

    useEffect(() => {
        const loadConnection = async () => {
            setLoading(true);
            setError('');

            try {
                const response = await tuyaService.getTuyaConnection();
                const payload = response.data;

                if (payload.connected && payload.data) {
                    setConnection(payload.data);
                    setForm((prev) => ({
                        ...prev,
                        clientId: payload.data.client_id || '',
                        region: payload.data.region || 'eu',
                        homeId: payload.data.home_id || '',
                    }));
                } else {
                    setConnection(null);
                }
            } catch (err) {
                // Compatibilité si l'API renvoie encore 404 sur absence de connexion
                if (err.response?.status === 404) {
                    setConnection(null);
                } else {
                    setError(err.response?.data?.message || 'Impossible de charger la connexion Tuya.');
                }
            } finally {
                setLoading(false);
            }
        };

        loadConnection();
    }, []);

    const handleChange = (field) => (event) => {
        setForm((prev) => ({
            ...prev,
            [field]: event.target.value,
        }));
    };

    const handleConnect = async (event) => {
        event.preventDefault();
        setSaving(true);
        setMessage('');
        setError('');

        if (!form.clientId || !form.clientSecret) {
            setError('Client ID et Client Secret sont obligatoires.');
            setSaving(false);
            return;
        }

        try {
            const data = await tuyaService.connectTuya(
                form.clientId,
                form.clientSecret,
                form.region,
                form.homeId
            );
            setConnection(data.data || null);
            setMessage(data.message || 'Connexion Tuya enregistree et liee a votre compte avec succes.');
            setForm((prev) => ({
                ...prev,
                clientSecret: '',
                homeId: data.data?.home_id || prev.homeId,
            }));
        } catch (err) {
            setError(err.response?.data?.message || 'La connexion Tuya a echoue. Verifiez vos identifiants.');
        } finally {
            setSaving(false);
        }
    };

    const handleDisconnect = async () => {
        setDisconnecting(true);
        setMessage('');
        setError('');

        try {
            await tuyaService.disconnectTuya();
            setConnection(null);
            setForm(defaultForm);
            setMessage('Connexion Tuya supprimee pour votre compte.');
        } catch (err) {
            setError(err.response?.data?.message || 'La deconnexion Tuya a echoue.');
        } finally {
            setDisconnecting(false);
        }
    };

    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>Parametres</h1>
                <p>Configuration des utilisateurs, roles et API externes.</p>
            </header>

            <article className="panel settings-panel">
                <div className="panel-head">
                    <div>
                        <h2>Connexion API Tuya</h2>
                        <p>Connexion persistante, enregistree par utilisateur authentifie.</p>
                    </div>
                    <span className={`tuya-status ${connection ? 'connected' : 'disconnected'}`}>
                        {connection ? 'Connecte' : 'Non connecte'}
                    </span>
                </div>

                {message && <div className="tuya-feedback success">{message}</div>}
                {error && <div className="tuya-feedback error">{error}</div>}

                {loading ? (
                    <p className="tuya-hint">Chargement de la connexion Tuya...</p>
                ) : (
                    <form className="tuya-form" onSubmit={handleConnect}>
                        <label>
                            Client ID
                            <input
                                type="text"
                                value={form.clientId}
                                onChange={handleChange('clientId')}
                                placeholder="Entrez votre Client ID Tuya"
                                autoComplete="off"
                            />
                        </label>

                        <label>
                            Client Secret
                            <input
                                type="password"
                                value={form.clientSecret}
                                onChange={handleChange('clientSecret')}
                                placeholder={connection ? 'Renseignez pour mettre a jour la connexion' : 'Entrez votre Client Secret Tuya'}
                                autoComplete="new-password"
                            />
                        </label>

                        <label>
                            Region
                            <select value={form.region} onChange={handleChange('region')}>
                                {regionOptions.map((region) => (
                                    <option key={region.value} value={region.value}>
                                        {region.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label>
                            Home ID (Smart Life / Tuya)
                            <input
                                type="text"
                                value={form.homeId}
                                onChange={handleChange('homeId')}
                                placeholder="Ex: 123456789"
                                autoComplete="off"
                            />
                        </label>

                        <div className="tuya-actions">
                            <button type="submit" disabled={saving || disconnecting}>
                                {saving ? 'Connexion en cours...' : connection ? 'Mettre a jour la connexion' : 'Connecter Tuya'}
                            </button>

                            {connection && (
                                <button
                                    type="button"
                                    className="secondary"
                                    onClick={handleDisconnect}
                                    disabled={saving || disconnecting}
                                >
                                    {disconnecting ? 'Deconnexion...' : 'Deconnecter'}
                                </button>
                            )}
                        </div>
                    </form>
                )}

                <p className="tuya-hint">
                    Chaque utilisateur conserve sa propre connexion Tuya. Un autre compte ne peut pas reutiliser la votre.
                </p>
                <p className="tuya-hint">
                    Le Home ID est requis pour synchroniser les pieces vers l'application Tuya / Smart Life.
                </p>
            </article>
        </section>
    );
}
