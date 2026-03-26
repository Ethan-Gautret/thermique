function formatDate(value) {
    if (!value) {
        return 'N/A';
    }

    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function getStatusMeta(enabled) {
    if (enabled === true) {
        return {
            label: 'Actif',
            cardClass: 'scenario-state on',
        };
    }

    if (enabled === false) {
        return {
            label: 'Inactif',
            cardClass: 'scenario-state off',
        };
    }

    return {
        label: 'Inconnu',
        cardClass: 'scenario-state unknown',
    };
}

export default function ScenarioCard({
    scenario,
}) {
    const {
        id,
        name,
        type,
        enabled,
        statusRaw,
        createdAt,
        updatedAt,
    } = scenario;

    const status = getStatusMeta(enabled);
    const normalizedType = (type || 'scenario').toString();

    return (
        <div className="scenario-card">
            <div className="scenario-header">
                <div className="scenario-header-content">
                    <div className="scenario-icon">📋</div>
                    <div>
                        <h3 className="scenario-title">{name || 'Scénario sans nom'}</h3>
                        <p className="scenario-description">Scénario créé dans Tuya</p>
                    </div>
                </div>
                <span className={status.cardClass}>{status.label}</span>
            </div>

            <div className="scenario-stats">
                <div className="stat-item">
                    <span className="stat-label">Statut</span>
                    <span className="stat-value scenario-stat-text">{status.label}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Type</span>
                    <span className="stat-value scenario-stat-text">{normalizedType}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">ID</span>
                    <span className="stat-value scenario-stat-id">{id || 'N/A'}</span>
                </div>
            </div>

            <div className="scenario-meta-grid">
                <div className="scenario-meta-item">
                    <span className="scenario-meta-label">Créé le</span>
                    <span className="scenario-meta-value">{formatDate(createdAt)}</span>
                </div>

                <div className="scenario-meta-item">
                    <span className="scenario-meta-label">Dernière mise à jour</span>
                    <span className="scenario-meta-value">{formatDate(updatedAt)}</span>
                </div>

                <div className="scenario-meta-item scenario-meta-item-wide">
                    <span className="scenario-meta-label">Statut brut Tuya</span>
                    <span className="scenario-meta-value">{statusRaw !== null && statusRaw !== undefined ? String(statusRaw) : 'N/A'}</span>
                </div>
            </div>
        </div>
    );
}
