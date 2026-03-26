import { useEffect, useMemo, useState } from 'react';
import tuyaService from '../../services/tuya';

function formatDate(value) {
    if (!value) {
        return 'N/A';
    }

    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function isAutomationType(type) {
    const normalized = (type || '').toString().toLowerCase();
    return normalized.includes('automation')
        || normalized.includes('linkage')
        || normalized.includes('rule');
}

function toAutomationCard(item) {
    const type = (item.type || 'automation').toString();
    const enabled = item.enabled;

    return {
        id: item.id,
        name: item.name || 'Automatisation sans nom',
        type,
        homeId: item.homeId || null,
        isAutomationType: isAutomationType(type),
        active: enabled === true,
        stateLabel: enabled === true ? 'Actif' : (enabled === false ? 'Inactif' : 'Inconnu'),
        statusRaw: item.statusRaw,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
    };
}

export default function AutomationsPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [automations, setAutomations] = useState([]);
    const [togglingAutomationId, setTogglingAutomationId] = useState(null);
    const [toggleBlockedReason, setToggleBlockedReason] = useState('');
    const isToggleBlocked = typeof toggleBlockedReason === 'string' && toggleBlockedReason.trim() !== '';

    const loadAutomations = async () => {
        setLoading(true);
        setError('');
        setInfoMessage('');
        setToggleBlockedReason('');

        try {
            const response = await tuyaService.getScenarios();
            const data = response?.data?.data;
            const apiMessage = response?.data?.message;
            const homeId = response?.data?.meta?.homeId || null;

            const sourceItems = Array.isArray(data) ? data : [];
            const normalized = sourceItems
                .map((item) => toAutomationCard({ ...item, homeId }))
                .sort((a, b) => Number(b.isAutomationType) - Number(a.isAutomationType));

            setAutomations(normalized);

            if (typeof apiMessage === 'string' && apiMessage.trim() !== '') {
                setInfoMessage(apiMessage);
            }
        } catch (err) {
            const apiMessage = err.response?.data?.message;
            setError(apiMessage || 'Impossible de charger les automatisations Tuya.');
            setAutomations([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAutomation = async (automation) => {
        if (!automation?.id || togglingAutomationId || isToggleBlocked) {
            return;
        }

        const targetEnabled = automation.active !== true;
        const previousActive = automation.active;
        const previousStatusRaw = automation.statusRaw;

        setError('');
        setInfoMessage('');
        setTogglingAutomationId(automation.id);

        setAutomations((current) =>
            current.map((item) =>
                item.id === automation.id
                    ? {
                        ...item,
                        active: targetEnabled,
                        stateLabel: targetEnabled ? 'Actif' : 'Inactif',
                        statusRaw: targetEnabled ? 'enable' : 'disable',
                    }
                    : item
            )
        );

        const rollback = () => {
            setAutomations((current) =>
                current.map((item) =>
                    item.id === automation.id
                        ? {
                            ...item,
                            active: previousActive,
                            stateLabel: previousActive === true ? 'Actif' : (previousActive === false ? 'Inactif' : 'Inconnu'),
                            statusRaw: previousStatusRaw,
                        }
                        : item
                )
            );
        };

        try {
            const response = await tuyaService.toggleScenario(
                automation.id,
                targetEnabled,
                automation.homeId || null,
                automation.type || null
            );

            const message = response?.data?.message;
            const success = response?.data?.success;
            const apiCode = response?.data?.code;

            if (success === false || apiCode === 'tuya_automation_permission_missing' || apiCode === 'tuya_toggle_not_supported') {
                rollback();

                if (apiCode === 'tuya_automation_permission_missing') {
                    setToggleBlockedReason('Modification indisponible sur ce projet Tuya: API Automation non souscrite.');
                    setInfoMessage('Le statut des automatisations reste consultable, mais la modification est indisponible avec les autorisations Tuya actuelles.');
                    return;
                }

                if (apiCode === 'tuya_toggle_not_supported') {
                    setToggleBlockedReason('Modification indisponible sur ce projet Tuya: endpoint de bascule non supporte.');
                    setInfoMessage('Le statut des automatisations est affiche en lecture seule pour eviter des erreurs repetitives.');
                    return;
                }

                setError(message || 'Impossible de modifier l\'etat de cette automatisation.');
                return;
            }

            setInfoMessage(message || 'Automatisation mise a jour avec succes.');
        } catch (err) {
            rollback();

            const apiMessage = err.response?.data?.message;
            const apiCode = err.response?.data?.code;
            const firstError = err.response?.data?.errors?.[0];
            const detail = firstError?.msg ? ` (${firstError.msg})` : '';

            if (apiCode === 'tuya_automation_permission_missing') {
                setToggleBlockedReason('Modification indisponible sur ce projet Tuya: API Automation non souscrite.');
                setInfoMessage('Le statut des automatisations reste consultable, mais la modification est indisponible avec les autorisations Tuya actuelles.');
                return;
            }

            setError((apiMessage || 'Impossible de modifier l\'etat de cette automatisation.') + detail);
        } finally {
            setTogglingAutomationId(null);
        }
    };

    useEffect(() => {
        loadAutomations();
    }, []);

    const stats = useMemo(() => {
        const total = automations.length;
        const active = automations.filter((item) => item.active).length;
        const inactive = total - active;
        const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;

        return { total, active, inactive, activeRate };
    }, [automations]);

    const activeAutomations = automations.filter((item) => item.active);

    return (
        <section className="page-shell automation-page">
            <header className="page-header automation-header">
                <div>
                    <h1>Automatisations</h1>
                    <p>Automatisations enregistrees dans Tuya</p>
                </div>
                <button type="button" className="automation-create-btn" onClick={loadAutomations} disabled={loading}>
                    {loading ? 'Chargement...' : 'Actualiser'}
                </button>
            </header>

            {!!error && <div className="tuya-feedback error">{error}</div>}
            {isToggleBlocked && <div className="tuya-feedback warning">{toggleBlockedReason}</div>}
            {!error && !!infoMessage && <div className="tuya-feedback success">{infoMessage}</div>}

            <div className="automation-stats-grid">
                <article className="automation-stat-card">
                    <div className="automation-stat-icon blue">◴</div>
                    <div>
                        <p className="automation-stat-label">Total</p>
                        <p className="automation-stat-value">{stats.total}</p>
                    </div>
                </article>

                <article className="automation-stat-card">
                    <div className="automation-stat-icon green">▷</div>
                    <div>
                        <p className="automation-stat-label">Actives</p>
                        <p className="automation-stat-value">{stats.active}</p>
                    </div>
                </article>

                <article className="automation-stat-card">
                    <div className="automation-stat-icon gray">||</div>
                    <div>
                        <p className="automation-stat-label">Inactives</p>
                        <p className="automation-stat-value">{stats.inactive}</p>
                    </div>
                </article>

                <article className="automation-stat-card">
                    <div className="automation-stat-icon mint">✓</div>
                    <div>
                        <p className="automation-stat-label">Taux actifs</p>
                        <p className="automation-stat-value">{stats.activeRate}%</p>
                    </div>
                </article>
            </div>

            <section className="automation-list-wrap">
                <h2>Automatisations actives ({activeAutomations.length})</h2>

                <div className="automation-list">
                    {!loading && automations.length === 0 && !error && (
                        <div className="placeholder-panel">
                            <h2>Aucune automatisation trouvee</h2>
                            <p>
                                Aucune regle Tuya n'a ete detectee sur le Home courant.
                            </p>
                        </div>
                    )}

                    {automations.map((automation) => (
                        <article key={automation.id} className="automation-item-card">
                            <div className="automation-item-top">
                                <div className="automation-item-title-wrap">
                                    <span className="automation-item-icon">◴</span>
                                    <div>
                                        <h3>
                                            {automation.name}
                                            <span className="automation-state-pill">{automation.stateLabel}</span>
                                            {!automation.isAutomationType && (
                                                <span className="automation-state-pill muted">Type non standard</span>
                                            )}
                                        </h3>
                                        <p>Type Tuya: {automation.type}</p>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    className={`automation-switch ${automation.active ? 'on' : 'off'}`}
                                    role="switch"
                                    aria-checked={automation.active}
                                    onClick={() => handleToggleAutomation(automation)}
                                    disabled={isToggleBlocked || togglingAutomationId === automation.id}
                                    title={toggleBlockedReason || ''}
                                >
                                    <span className="automation-switch-thumb" />
                                </button>
                            </div>

                            <div className="automation-item-meta">
                                <span>ID: {automation.id || 'N/A'}</span>
                                <span>Cree le: {formatDate(automation.createdAt)}</span>
                            </div>

                            <div className="automation-item-actions">
                                <p>Etat Tuya:</p>
                                <div className="automation-action-line">
                                    <span>{automation.statusRaw !== null && automation.statusRaw !== undefined ? String(automation.statusRaw) : 'N/A'}</span>
                                    <small>
                                        {isToggleBlocked
                                            ? 'Indisponible sur ce projet Tuya'
                                            : (togglingAutomationId === automation.id ? 'Mise a jour...' : 'Interactive')}
                                    </small>
                                </div>
                            </div>

                            <p className="automation-last-run">Derniere mise a jour: {formatDate(automation.updatedAt)}</p>
                        </article>
                    ))}
                </div>
            </section>

            {loading && (
                <div className="loading-container">
                    <div className="loader-ring"></div>
                    <p>Chargement des automatisations...</p>
                </div>
            )}
        </section>
    );
}
