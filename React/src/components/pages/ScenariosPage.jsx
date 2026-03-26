import { useEffect, useState } from 'react';
import tuyaService from '../../services/tuya';
import ScenarioCard from '../ScenarioCard';

// Helper function to transform API scenario data to component format
function transformScenarioData(apiScenario) {
    return {
        id: apiScenario.id,
        name: apiScenario.name || 'Scénario sans nom',
        type: apiScenario.type || 'scenario',
        enabled: apiScenario.enabled,
        statusRaw: apiScenario.statusRaw,
        createdAt: apiScenario.createdAt,
        updatedAt: apiScenario.updatedAt,
    };
}

export default function ScenariosPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [scenarios, setScenarios] = useState([]);

    const loadScenarios = async () => {
        setLoading(true);
        setError('');
        setInfoMessage('');

        try {
            const response = await tuyaService.getScenarios();
            const data = response?.data?.data;
            const message = response?.data?.message;
            const homeId = response?.data?.meta?.homeId || null;

            if (Array.isArray(data)) {
                const transformedScenarios = data.map((scenario) => transformScenarioData({
                    ...scenario,
                    homeId,
                }));
                setScenarios(transformedScenarios);
            } else {
                setScenarios([]);
            }

            if (typeof message === 'string' && message.trim() !== '') {
                setInfoMessage(message);
            }
        } catch (err) {
            const apiMessage = err.response?.data?.message;
            setError(apiMessage || 'Impossible de charger les scenarios Tuya.');
            setScenarios([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadScenarios();
    }, []);

    return (
        <section className="page-shell">
            <header className="page-header">
                <div className="page-header-row">
                    <div>
                        <h1>Scénarios</h1>
                        <p>Configurations prédéfinies pour différents contextes d'utilisation</p>
                    </div>
                    <button
                        type="button"
                        className="refresh-button"
                        onClick={loadScenarios}
                        disabled={loading}
                    >
                        {loading ? 'Chargement...' : 'Actualiser'}
                    </button>
                </div>
            </header>

            <div className="scenarios-container">
                {!!error && <div className="tuya-feedback error">{error}</div>}

                {!error && !!infoMessage && (
                    <div className="tuya-feedback success">{infoMessage}</div>
                )}

                {!loading && scenarios.length === 0 && !error && (
                    <div className="placeholder-panel">
                        <h2>Aucun scénario trouvé</h2>
                        <p>
                            {infoMessage || 'Aucun scénario disponible pour le moment.'}
                        </p>
                    </div>
                )}

                {!loading && scenarios.length > 0 && (
                    <div className="scenarios-grid">
                        {scenarios.map((scenario) => (
                            <ScenarioCard
                                key={scenario.id || scenario.name}
                                scenario={scenario}
                            />
                        ))}
                    </div>
                )}

                {loading && (
                    <div className="loading-container">
                        <div className="loader-ring"></div>
                        <p>Chargement des scénarios...</p>
                    </div>
                )}
            </div>
        </section>
    );
}
