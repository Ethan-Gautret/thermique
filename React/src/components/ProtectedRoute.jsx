import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authService } from '../services/api';

export default function ProtectedRoute() {
    const location = useLocation();

    if (!authService.isAuthenticated()) {
        return <Navigate to="/login" replace state={{ from: location }} />;
    }

    return <Outlet />;
}
