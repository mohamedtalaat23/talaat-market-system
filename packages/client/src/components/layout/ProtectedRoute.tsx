import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Spinner } from '@/components/ui/Spinner';

interface ProtectedRouteProps {
  children?: React.ReactNode;
  allowedRoles?: ('admin' | 'manager' | 'cashier')[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-neutral-950 text-foreground">
        <Spinner size="lg" />
        <span className="mt-4 text-sm text-neutral-400">Verifying session...</span>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    // Redirect to login but save the current location they tried to access
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Role not authorized, redirect to dashboard
    return <Navigate to="/" replace />;
  }

  return children ? <>{children}</> : null;
}
