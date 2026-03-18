const temperaturePoints = [
    { label: '4h30', value: 18.8 },
    { label: '5h30', value: 20.3 },
    { label: '6h30', value: 17.7 },
    { label: '7h30', value: 19.2 },
    { label: '8h30', value: 21.0 },
    { label: '9h30', value: 17.0 },
    { label: '10h30', value: 20.8 },
    { label: '11h30', value: 18.9 },
];

function buildPolyline(points) {
    const width = 100;
    const height = 40;
    const min = Math.min(...points.map((point) => point.value));
    const max = Math.max(...points.map((point) => point.value));

    return points
        .map((point, index) => {
            const x = (index / (points.length - 1)) * width;
            const normalized = (point.value - min) / Math.max(max - min, 1);
            const y = height - normalized * height;
            return `${x},${y}`;
        })
        .join(' ');
}

const chartLine = buildPolyline(temperaturePoints);

const sites = [
    {
        name: 'Mairie Centre-Ville',
        address: '12 Place de la Republique, 75000 Paris',
        temperature: '20.6 C',
        devices: '4/4',
        badge: 'public',
    },
    {
        name: 'Camping Les Pins',
        address: 'Route de la Mer, 33000 Bordeaux',
        temperature: '14.9 C',
        devices: '0/3',
        badge: 'hospitality',
    },
    {
        name: 'Entrepot Logistique Nord',
        address: 'ZI du Nord, 59000 Lille',
        temperature: '18.6 C',
        devices: '2/2',
        badge: 'industrial',
    },
];

const upcomingActions = [
    {
        title: 'Chauffage bureaux - Matin',
        detail: 'Mise en confort bureaux 06:00',
        meta: 'jeu. 12 mars, 08:14',
        eta: '21h',
    },
    {
        title: 'Chauffage bureaux - Soir',
        detail: 'Passage en eco bureaux 18:00',
        meta: 'jeu. 12 mars, 09:14',
        eta: '22h',
    },
    {
        title: 'Reactivation atelier lundi',
        detail: 'Remise en chauffe atelier lundi matin',
        meta: 'dim. 15 mars, 10:14',
        eta: '95h',
    },
];

export default function DashboardPage() {
    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>Dashboard</h1>
                <p>Vue d'ensemble de votre systeme de gestion technique du batiment</p>
            </header>

            <div className="stats-grid">
                <article className="stat-card">
                    <p className="stat-title">Temperature moyenne</p>
                    <p className="stat-value">18.3 C</p>
                    <p className="stat-foot positive">+0.5 C depuis hier</p>
                </article>

                <article className="stat-card">
                    <p className="stat-title">Equipements actifs</p>
                    <p className="stat-value">6/9</p>
                    <p className="stat-foot">+6 en ligne</p>
                </article>

                <article className="stat-card">
                    <p className="stat-title">Alertes actives</p>
                    <p className="stat-value">2</p>
                    <p className="stat-foot warning">1 critique</p>
                </article>

                <article className="stat-card">
                    <p className="stat-title">Puissance instantanee</p>
                    <p className="stat-value">45.3 kW</p>
                    <p className="stat-foot">+15% vs semaine derniere</p>
                </article>
            </div>

            <div className="primary-grid">
                <article className="panel chart-panel">
                    <div className="panel-head">
                        <h2>Evolution temperature (7 jours)</h2>
                        <p>Moyenne tous equipements</p>
                    </div>

                    <div className="line-chart">
                        <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Courbe temperature 7 jours">
                            <defs>
                                <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(249, 115, 22, 0.28)" />
                                    <stop offset="100%" stopColor="rgba(249, 115, 22, 0.04)" />
                                </linearGradient>
                            </defs>
                            <polyline points={chartLine} fill="none" stroke="#f97316" strokeWidth="0.8" />
                            <polygon points={`0,40 ${chartLine} 100,40`} fill="url(#chartFill)" />
                        </svg>
                        <div className="chart-axis">
                            {temperaturePoints.map((point) => (
                                <span key={point.label}>{point.label}</span>
                            ))}
                        </div>
                    </div>
                </article>

                <aside className="panel actions-panel">
                    <div className="panel-head">
                        <h2>Prochaines actions</h2>
                    </div>

                    <ul className="actions-list">
                        {upcomingActions.map((action) => (
                            <li key={action.title}>
                                <div>
                                    <p className="action-title">{action.title}</p>
                                    <p className="action-detail">{action.detail}</p>
                                    <p className="action-meta">{action.meta}</p>
                                </div>
                                <span>{action.eta}</span>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>

            <article className="panel">
                <div className="panel-head">
                    <h2>Vue par site</h2>
                </div>

                <div className="site-grid">
                    {sites.map((site) => (
                        <article key={site.name} className="site-card">
                            <div className="site-head">
                                <h3>{site.name}</h3>
                                <span>{site.badge}</span>
                            </div>
                            <p>{site.address}</p>
                            <div className="site-metrics">
                                <div>
                                    <small>Temperature</small>
                                    <strong>{site.temperature}</strong>
                                </div>
                                <div>
                                    <small>Actifs</small>
                                    <strong>{site.devices}</strong>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </article>

            <article className="panel alerts-panel">
                <div className="panel-head">
                    <h2>Alertes en cours</h2>
                    <span className="badge">2</span>
                </div>

                <div className="alert-card critical">
                    <p>Sanitaires Bloc A hors ligne depuis 1h</p>
                    <small>Sanitaires Bloc A - 11/03/2026 09:14:44</small>
                    <span>high</span>
                </div>

                <div className="alert-card medium">
                    <p>Temperature atelier sous le seuil (16.8 C &lt; 17 C)</p>
                    <small>Aerotherme Atelier - 11/03/2026 09:59:44</small>
                    <span>medium</span>
                </div>
            </article>
        </section>
    );
}
