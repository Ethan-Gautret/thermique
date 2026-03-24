import { useEffect, useState } from 'react';
import tuyaService from '../../services/tuya';

const temperatureCodes = ['va_temperature', 'temp_current', 'temperature', 'cur_temperature', 'cur_temp'];

function parseTemperatureValue(code, rawValue) {
    const numericValue = Number(rawValue);

    if (!Number.isFinite(numericValue)) {
        return null;
    }

    const normalizedCode = String(code || '').toLowerCase();
    const needsDecimalScale = normalizedCode.includes('va_temperature') || Math.abs(numericValue) > 70;
    return needsDecimalScale ? numericValue / 10 : numericValue;
}

function extractDeviceTemperature(device) {
    const properties = Array.isArray(device?.properties) ? device.properties : [];

    const match = properties.find((property) => {
        const code = String(property?.code || '').toLowerCase();
        return temperatureCodes.some((pattern) => code.includes(pattern));
    });

    if (!match) {
        return null;
    }

    return parseTemperatureValue(match.code, match.value);
}

function buildChartGeometry(points, min, max) {
    const width = 100;
    const height = 40;
    const denominator = Math.max(points.length - 1, 1);
    const coordinates = points
        .map((point, index) => {
            const rawValue = point?.value;
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                return null;
            }

            const value = Number(rawValue);
            if (!Number.isFinite(value)) {
                return null;
            }

            const x = (index / denominator) * width;
            const normalized = (value - min) / Math.max(max - min, 1);
            const y = height - normalized * height;
            return { x, y };
        })
        .filter(Boolean);

    if (coordinates.length === 0) {
        return {
            polyline: '',
            polygon: '',
            pointCount: 0,
            coordinates: [],
        };
    }

    const polyline = coordinates
        .map((point) => `${point.x},${point.y}`)
        .join(' ');

    const polygon = coordinates.length >= 2
        ? `${coordinates[0].x},40 ${polyline} ${coordinates[coordinates.length - 1].x},40`
        : '';

    return {
        polyline,
        polygon,
        pointCount: coordinates.length,
        coordinates,
    };
}

function buildHourSlotDots(points) {
    const width = 100;
    const denominator = Math.max(points.length - 1, 1);

    return points.map((point, index) => {
        return {
            x: (index / denominator) * width,
            key: point?.hourBucket || point?.label || String(index),
        };
    });
}

function buildLastHoursPoints(series, hours = 12) {
    const now = new Date();
    now.setMinutes(0, 0, 0);

    const keyedValues = new Map();
    (Array.isArray(series) ? series : []).forEach((point) => {
        const bucket = String(point?.hourBucket || '');
        const value = Number(point?.value);

        if (!bucket || !Number.isFinite(value)) {
            return;
        }

        const parsed = new Date(bucket);
        if (Number.isNaN(parsed.getTime())) {
            return;
        }

        parsed.setMinutes(0, 0, 0);
        const key = parsed.toISOString();
        keyedValues.set(key, value);
    });

    return Array.from({ length: hours }, (_, index) => {
        const slot = new Date(now);
        slot.setHours(now.getHours() - (hours - 1 - index));

        const key = slot.toISOString();
        const label = `${String(slot.getHours()).padStart(2, '0')}:00`;

        return {
            label,
            value: keyedValues.has(key) ? keyedValues.get(key) : null,
            hourBucket: key,
        };
    });
}

function buildTemperatureScale(points) {
    const values = points
        .map((point) => {
            const rawValue = point?.value;
            if (rawValue === null || rawValue === undefined || rawValue === '') {
                return null;
            }

            const numericValue = Number(rawValue);
            return Number.isFinite(numericValue) ? numericValue : null;
        })
        .filter((value) => value !== null);

    if (values.length === 0) {
        const fallbackTicks = [22, 21, 20, 19, 18];
        const fallbackMinorTicks = [21.5, 20.5, 19.5, 18.5];
        return {
            min: 18,
            max: 22,
            ticks: fallbackTicks,
            minorTicks: fallbackMinorTicks,
        };
    }

    const sourceMin = Math.min(...values);
    const sourceMax = Math.max(...values);
    let min = Math.floor(sourceMin);
    let max = Math.ceil(sourceMax);

    if (max === min) {
        min -= 1;
        max += 1;
    }

    // Keep a readable temperature ladder when values are very close (e.g. one recorded hour).
    if ((max - min) < 4) {
        const center = Math.round((sourceMin + sourceMax) / 2);
        min = center - 2;
        max = center + 2;
    }

    const range = Math.max(max - min, 1);
    const step = range > 8 ? Math.ceil(range / 8) : 1;

    const ticks = [];
    for (let value = max; value >= min; value -= step) {
        ticks.push(value);
    }

    if (ticks[ticks.length - 1] !== min) {
        ticks.push(min);
    }

    const minorTicks = [];
    for (let index = 0; index < ticks.length - 1; index += 1) {
        const current = ticks[index];
        const next = ticks[index + 1];
        minorTicks.push(Number(((current + next) / 2).toFixed(1)));
    }

    return {
        min,
        max,
        ticks,
        minorTicks,
    };
}

function temperatureToChartY(value, min, max) {
    const height = 40;
    const normalized = (value - min) / Math.max(max - min, 1);
    return height - normalized * height;
}

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
    const [deviceStats, setDeviceStats] = useState({
        loading: true,
        total: 0,
        online: 0,
        averageTemperature: null,
        temperatureDeviceCount: 0,
        temperatureSeries: [],
        hoursWithData: 0,
    });

    useEffect(() => {
        const loadDeviceStats = async () => {
            try {
                const [devicesResponse, seriesResponse] = await Promise.all([
                    tuyaService.getDevices(),
                    tuyaService.getDailyTemperatureSeries(),
                ]);
                const devices = devicesResponse.data?.data || [];
                const online = devices.filter((device) => device.online).length;
                const temperatureSeriesRaw = seriesResponse.data?.data?.series || [];
                const temperatureSeries = temperatureSeriesRaw
                    .filter((point) => Number.isFinite(Number(point?.value)))
                    .map((point) => ({
                        label: String(point.label || ''),
                        value: Number(point.value),
                        hourBucket: String(point.hourBucket || ''),
                        devicesCount: Number(point.devicesCount || 0),
                    }));
                const latestPoint = temperatureSeries.length > 0
                    ? temperatureSeries[temperatureSeries.length - 1]
                    : null;
                const averageTemperature = latestPoint ? Number(latestPoint.value) : null;
                const temperatureDeviceCount = latestPoint
                    ? Number(latestPoint.devicesCount || 0)
                    : 0;

                setDeviceStats({
                    loading: false,
                    total: devices.length,
                    online,
                    averageTemperature,
                    temperatureDeviceCount,
                    temperatureSeries,
                    hoursWithData: Number(seriesResponse.data?.data?.meta?.hoursWithData || 0),
                });
            } catch {
                setDeviceStats({
                    loading: false,
                    total: 0,
                    online: 0,
                    averageTemperature: null,
                    temperatureDeviceCount: 0,
                    temperatureSeries: [],
                    hoursWithData: 0,
                });
            }
        };

        loadDeviceStats();
        const refreshInterval = setInterval(loadDeviceStats, 5 * 60 * 1000);

        return () => clearInterval(refreshInterval);
    }, []);

    const chartPoints = buildLastHoursPoints(deviceStats.temperatureSeries, 12);
    const visibleHoursWithData = chartPoints
        .filter((point) => point.value !== null && point.value !== undefined && point.value !== '')
        .filter((point) => Number.isFinite(Number(point.value)))
        .length;
    const temperatureScale = buildTemperatureScale(chartPoints);
    const chartGeometry = buildChartGeometry(chartPoints, temperatureScale.min, temperatureScale.max);
    const hourSlotDots = buildHourSlotDots(chartPoints);

    return (
        <section className="page-shell">
            <header className="page-header">
                <h1>Dashboard</h1>
                <p>Vue d'ensemble de votre systeme de gestion technique du batiment</p>
            </header>

            <div className="stats-grid">
                <article className="stat-card">
                    <p className="stat-title">Temperature moyenne</p>
                    <p className="stat-value">
                        {deviceStats.loading
                            ? '...'
                            : (deviceStats.averageTemperature === null
                                ? 'N/A'
                                : `${deviceStats.averageTemperature.toFixed(1)} C`)}
                    </p>
                    <p className="stat-foot">
                        {deviceStats.loading
                            ? 'Analyse des capteurs...'
                            : `${deviceStats.temperatureDeviceCount} equipement(s) avec temperature`}
                    </p>
                </article>

                <article className="stat-card">
                    <p className="stat-title">Equipements actifs</p>
                    <p className="stat-value">
                        {deviceStats.loading ? '...' : `${deviceStats.online}/${deviceStats.total}`}
                    </p>
                    <p className="stat-foot">
                        {deviceStats.loading ? 'Chargement des equipements...' : `${deviceStats.online} en ligne`}
                    </p>
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
                        <h2>Evolution temperature (12 dernieres heures)</h2>
                        <p>
                            {deviceStats.loading
                                ? 'Chargement des donnees temperature...'
                                : `${visibleHoursWithData}/12 heure(s) avec donnees`}
                        </p>
                    </div>

                    <div className="line-chart">
                        <div className="line-chart-body">
                            <div className="chart-y-axis" aria-hidden="true">
                                {temperatureScale.ticks.map((tick) => (
                                    <span key={tick}>{tick} C</span>
                                ))}
                            </div>

                            <div className="chart-plot">
                                <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label="Courbe temperature des capteurs">
                                    <defs>
                                        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="rgba(249, 115, 22, 0.28)" />
                                            <stop offset="100%" stopColor="rgba(249, 115, 22, 0.04)" />
                                        </linearGradient>
                                    </defs>

                                    {temperatureScale.minorTicks.map((tick) => {
                                        const y = temperatureToChartY(tick, temperatureScale.min, temperatureScale.max);
                                        return (
                                            <line
                                                key={`minor-grid-${tick}`}
                                                x1="0"
                                                y1={y}
                                                x2="100"
                                                y2={y}
                                                stroke="#e2e8f0"
                                                strokeWidth="0.25"
                                            />
                                        );
                                    })}

                                    {temperatureScale.ticks.map((tick) => {
                                        const y = temperatureToChartY(tick, temperatureScale.min, temperatureScale.max);
                                        return (
                                            <line
                                                key={`grid-${tick}`}
                                                x1="0"
                                                y1={y}
                                                x2="100"
                                                y2={y}
                                                stroke="#cbd5e1"
                                                strokeWidth="0.35"
                                            />
                                        );
                                    })}

                                    {hourSlotDots.map((dot) => (
                                        <circle
                                            key={`hour-slot-${dot.key}`}
                                            cx={dot.x}
                                            cy="39.4"
                                            r="0.24"
                                            fill="#cbd5e1"
                                            opacity="0.9"
                                        />
                                    ))}

                                    {chartGeometry.pointCount >= 2 && (
                                        <polyline points={chartGeometry.polyline} fill="none" stroke="#c2410c" strokeWidth="1.05" />
                                    )}
                                    {chartGeometry.pointCount >= 2 && (
                                        <polygon points={chartGeometry.polygon} fill="url(#chartFill)" />
                                    )}
                                    {chartGeometry.coordinates.map((point, index) => (
                                        <circle
                                            key={`point-${index}`}
                                            cx={point.x}
                                            cy={point.y}
                                            r="0.55"
                                            fill="#c2410c"
                                            stroke="#fff7ed"
                                            strokeWidth="0.2"
                                        />
                                    ))}
                                </svg>

                                <div
                                    className="chart-axis"
                                    style={{ gridTemplateColumns: `repeat(${chartPoints.length}, minmax(0, 1fr))` }}
                                >
                                    {chartPoints.map((point, index) => (
                                        <span key={point.hourBucket || point.label}>{index % 2 === 0 ? point.label : ''}</span>
                                    ))}
                                </div>
                            </div>
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
