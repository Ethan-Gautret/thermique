import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { authService } from '../../services/api';

const navItems = [
    { to: '/', label: 'Dashboard', icon: '▦' },
    { to: '/calendrier', label: 'Calendrier', icon: '◷' },
    { to: '/equipements', label: 'Equipements', icon: '◉' },
    { to: '/sites-zones', label: 'Sites & Pieces', icon: '⌂' },
    { to: '/scenarios', label: 'Scenarios', icon: '≋' },
    { to: '/automations', label: 'Automatisations', icon: '⚙' },
    { to: '/alertes', label: 'Alertes', icon: '!' },
    { to: '/rapports', label: 'Rapports', icon: '▤' },
    { to: '/parametres', label: 'Parametres', icon: '⚑' },
];

export default function AppLayout() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [menuOpen, setMenuOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const loadUser = async () => {
            try {
                const response = await authService.getCurrentUser();
                setUser(response.data);
            } catch {
                localStorage.removeItem('auth_token');
                navigate('/login', { replace: true });
            } finally {
                setLoading(false);
            }
        };

        loadUser();
    }, [navigate]);

    const handleLogout = async () => {
        try {
            await authService.logout();
        } finally {
            localStorage.removeItem('auth_token');
            navigate('/login', { replace: true });
        }
    };

    if (loading) {
        return (
            <div className="app-loading">
                <div className="loader-ring" />
                <p>Chargement du dashboard...</p>
            </div>
        );
    }

    return (
        <div className={`app-frame ${menuOpen ? 'menu-open' : ''}`}>
            <aside className="sidebar">
                <div className="brand-block">
                    <span className="brand-logo">GTB</span>
                    <div>
                        <h1>Smart Life</h1>
                        <p>Gestion technique batiment</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                `sidebar-link ${isActive ? 'active' : ''}`
                            }
                            onClick={() => setMenuOpen(false)}
                        >
                            <span className="link-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <div className="user-line">
                        <p>{user?.name}</p>
                        <small>{user?.email}</small>
                    </div>
                    <button type="button" onClick={handleLogout}>
                        Deconnexion
                    </button>
                </div>
            </aside>

            <div className="content-area">
                <header className="mobile-bar">
                    <button
                        type="button"
                        onClick={() => setMenuOpen((open) => !open)}
                        className="menu-button"
                    >
                        Menu
                    </button>
                    <span>Thermique</span>
                </header>

                <main className="main-view">
                    <Outlet context={{ user }} />
                </main>
            </div>
        </div>
    );
}
