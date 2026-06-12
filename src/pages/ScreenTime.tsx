import { Navigate, useLocation } from 'react-router-dom';

export default function ScreenTimePage() {
  const location = useLocation();

  return <Navigate to={{ pathname: '/stats', search: location.search }} replace />;
}
