import { useEffect, useState } from 'react';
import tuyaService from '../../services/tuya';
import sitesZonesService from '../../services/sitesZones';

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
        const label = `${slot.getHours()}h`;

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

    // Ajoute une marge visuelle de 0.5°C autour de la courbe
    let min = Math.floor(sourceMin * 2) / 2 - 0.5;
    let max = Math.ceil(sourceMax * 2) / 2 + 0.5;

    // Si toutes les valeurs sont identiques, force une petite plage
    if (max === min) {
        min -= 1;
        max += 1;
    }

    // Si la plage est très faible (<2°C), élargit légèrement pour la lisibilité
    if ((max - min) < 2) {
        const center = (sourceMin + sourceMax) / 2;
        min = Math.floor(center - 1);
        max = Math.ceil(center + 1);
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

function parseTriggerTimeToMinutes(triggerTime) {
    if (triggerTime === null || triggerTime === undefined) {
        return null;
    }

    const text = String(triggerTime).trim();
    if (text === '') {
        return null;
    }

    const hhmmMatch = text.match(/^(\d{1,2}):(\d{2})$/);
    if (hhmmMatch) {
        const hours = Number(hhmmMatch[1]);
        const minutes = Number(hhmmMatch[2]);
        if (Number.isInteger(hours) && Number.isInteger(minutes) && hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
            return (hours * 60) + minutes;
        }
    }

    if (/^\d+$/.test(text)) {
        const numeric = Number(text);

        if (numeric >= 0 && numeric <= 2359) {
            const hours = Math.floor(numeric / 100);
            const minutes = numeric % 100;
            if (hours <= 23 && minutes <= 59) {
                return (hours * 60) + minutes;
            }
        }

        if (numeric >= 0 && numeric <= 1439) {
            return numeric;
        }

        if (numeric >= 0 && numeric <= 86399) {
            return Math.floor(numeric / 60);
        }
    }

    return null;
}

function formatEta(targetDate) {
    const diffMs = Math.max(targetDate.getTime() - Date.now(), 0);
    const diffMinutes = Math.ceil(diffMs / 60000);
    const days = Math.floor(diffMinutes / 1440);
    const remainingMinutes = diffMinutes % 1440;
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = remainingMinutes % 60;

    if (days > 0 && hours > 0) {
        return `${days}j ${hours}h`;
    }

    if (days > 0) {
        return `${days}j`;
    }

    if (hours > 0 && minutes > 0) {
        return `${hours}h ${minutes}m`;
    }

    if (hours > 0) {
        return `${hours}h`;
    }

    return `${Math.max(minutes, 1)}m`;
}

function isAutomationType(type) {
    const normalized = String(type || '').toLowerCase();
    return normalized.includes('automation') || normalized.includes('linkage') || normalized.includes('rule');
}

function normalizeWeekDays(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return Array.from(new Set(
        value
            .map((entry) => Number(entry))
            .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    ));
}

function formatWeekDaysLabel(days) {
    const normalized = normalizeWeekDays(days);
    if (normalized.length === 0 || normalized.length === 7) {
        return 'Tous les jours';
    }

    const names = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
    return normalized
        .sort((a, b) => a - b)
        .map((day) => names[day])
        .join(', ');
}

function computeNextExecutionDate(triggerMinutes, weekDays) {
    if (!Number.isFinite(triggerMinutes)) {
        return null;
    }

    const now = new Date();
    const allowedDays = normalizeWeekDays(weekDays);

    for (let offset = 0; offset <= 14; offset += 1) {
        const candidate = new Date(now);
        candidate.setSeconds(0, 0);
        candidate.setDate(now.getDate() + offset);
        candidate.setHours(Math.floor(triggerMinutes / 60), triggerMinutes % 60, 0, 0);

        const dayOfWeek = candidate.getDay();
        const isAllowedDay = allowedDays.length === 0 || allowedDays.includes(dayOfWeek);

        if (!isAllowedDay) {
            continue;
        }

        if (candidate.getTime() > now.getTime()) {
            return candidate;
        }
    }

    return null;
}

function buildUpcomingAutomationActions(rawScenarios, limit = 3) {
    const computed = (Array.isArray(rawScenarios) ? rawScenarios : [])
        .filter((item) => item && item.enabled !== false)
        // On ne garde que les vraies automatisations planifiées (horaire détecté)
        .filter((item) => {
            const triggerTime = item.triggerTime || null;
            const triggerMinutes = parseTriggerTimeToMinutes(triggerTime);
            return triggerMinutes !== null;
        })
        .map((item) => {
            const triggerTime = item.triggerTime || null;
            const triggerMinutes = parseTriggerTimeToMinutes(triggerTime);
            const nextAt = computeNextExecutionDate(triggerMinutes, item.weekDays);
            if (!nextAt) {
                return null;
            }
            return {
                id: item.id || `${item.name || 'automation'}-${triggerTime}`,
                title: item.name || 'Automatisation sans nom',
                detail: `Declenchement programme a ${triggerTime} (${formatWeekDaysLabel(item.weekDays)})`,
                meta: nextAt.toLocaleString('fr-FR', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                }),
                eta: formatEta(nextAt),
                nextAt,
                hasSchedule: true,
            };
        })
        .filter(Boolean)
        .sort((a, b) => {
            if (!a.nextAt || !b.nextAt) {
                return 0;
            }
            return a.nextAt.getTime() - b.nextAt.getTime();
        });

    return computed.slice(0, limit);
}

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
    const [siteOverview, setSiteOverview] = useState({
        loading: true,
        items: [],
    });
    const [upcomingAutomationActions, setUpcomingAutomationActions] = useState([]);

    useEffect(() => {
        const loadDeviceStats = async () => {
            try {
                const [devicesResponse, seriesResponse, sitesResponse, roomsResponse] = await Promise.all([
                    tuyaService.getDevices(),
                    tuyaService.getDailyTemperatureSeries(),
                    sitesZonesService.getSites(),
                    sitesZonesService.getRooms(),
                ]);
                const devices = devicesResponse.data?.data || [];
                const sites = sitesResponse.data?.data || [];
                const rooms = roomsResponse.data?.data || [];
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

                const deviceById = new Map(devices.map((device) => [String(device.id), device]));

                const items = sites.map((site) => {
                    const siteRooms = rooms.filter((room) => Number(room.siteId) === Number(site.id));
                    const roomNames = siteRooms.map((room) => room.name).filter(Boolean);
                    const uniqueDeviceIds = Array.from(new Set(
                        siteRooms.flatMap((room) => Array.isArray(room.deviceIds) ? room.deviceIds : [])
                    ));
                    const mappedDevices = uniqueDeviceIds
                        .map((deviceId) => deviceById.get(String(deviceId)))
                        .filter(Boolean);

                    const onlineCount = mappedDevices.filter((device) => Boolean(device.online)).length;

                    const temperatures = mappedDevices
                        .map((device) => extractDeviceTemperature(device))
                        .filter((value) => Number.isFinite(value));

                    const averageTemperature = temperatures.length > 0
                        ? (temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length)
                        : null;

                    return {
                        id: site.id,
                        name: site.name,
                        address: site.address,
                        roomsCount: siteRooms.length,
                        roomNames,
                        devicesTotal: mappedDevices.length,
                        devicesOnline: onlineCount,
                        averageTemperature,
                        createdAt: site.createdAt,
                    };
                });

                setSiteOverview({
                    loading: false,
                    items,
                });

                try {
                    const scenariosResponse = await tuyaService.getScenarios();
                    const rawScenarios = scenariosResponse.data?.data || [];
                    setUpcomingAutomationActions(buildUpcomingAutomationActions(rawScenarios, 8));
                } catch {
                    setUpcomingAutomationActions([]);
                }
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
                setSiteOverview({
                    loading: false,
                    items: [],
                });
                setUpcomingAutomationActions([]);
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
                                    aria-hidden="true"
                                >
                                    {chartPoints.map((point, index) => (
                                        <span
                                            key={point.hourBucket || point.label}
                                            className={`chart-axis-label ${index === 0 ? 'start' : ''} ${index === chartPoints.length - 1 ? 'end' : ''}`}
                                            style={{ left: `${(index / Math.max(chartPoints.length - 1, 1)) * 100}%` }}
                                        >
                                            {point.label}
                                        </span>
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
                        {upcomingAutomationActions.length === 0 && (
                            <li>
                                <div>
                                    <p className="action-title">Aucune automatisation planifiee</p>
                                    <p className="action-detail">Ajoute une heure de declenchement dans Tuya pour voir les prochaines actions ici.</p>
                                    <p className="action-meta">Source: automatisations Tuya actives</p>
                                </div>
                                <span>--</span>
                            </li>
                        )}

                        {upcomingAutomationActions.map((action) => (
                            <li key={action.id}>
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
                    {siteOverview.loading && (
                        <p className="tuya-hint">Chargement des sites...</p>
                    )}

                    {!siteOverview.loading && siteOverview.items.length === 0 && (
                        <p className="tuya-hint">Aucun site enregistre pour le moment.</p>
                    )}

                    {!siteOverview.loading && siteOverview.items.map((site) => (
                        <article key={site.id} className="site-card">
                            <div className="site-head">
                                <h3>{site.name}</h3>
                                <span>{site.roomsCount} piece(s)</span>
                            </div>
                            <p>{site.address || 'Adresse non renseignee'}</p>
                            <div className="site-metrics">
                                <div>
                                    <small>Temperature moyenne</small>
                                    <strong>
                                        {site.averageTemperature === null
                                            ? 'N/A'
                                            : `${site.averageTemperature.toFixed(1)} C`}
                                    </strong>
                                </div>
                                <div>
                                    <small>Equipements actifs</small>
                                    <strong>{site.devicesOnline}/{site.devicesTotal}</strong>
                                </div>
                            </div>
                            <p className="action-meta">
                                {site.roomNames.length > 0
                                    ? `Pieces: ${site.roomNames.slice(0, 3).join(', ')}${site.roomNames.length > 3 ? '...' : ''}`
                                    : 'Aucune piece associee'}
                            </p>
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
