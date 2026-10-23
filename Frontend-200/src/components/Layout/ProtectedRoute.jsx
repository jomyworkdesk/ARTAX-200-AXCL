import { Navigate, Outlet } from 'react-router-dom';
import { getSessionItem } from '../../services/sessionStorageService';

const ProtectedRoute = () => {
  const token = getSessionItem('token');
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
