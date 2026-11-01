import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ProtectedRoute } from '../ProtectedRoute';

function LoginDestination() {
  const location = useLocation();
  return <div>Login from {location.state?.from?.pathname}</div>;
}

function renderRoutes() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route
          path="/settings"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <div>Settings</div>
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<LoginDestination />} />
        <Route path="/change-password" element={<div>Change password</div>} />
        <Route path="/" element={<div>Dashboard</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() =>
  useAuthStore.setState({
    isAuthenticated: true,
    isLoading: false,
    user: { id: 1, username: 'operator', role: 'admin' },
  }),
);
afterEach(() => {
  cleanup();
  useAuthStore.setState({ user: null, isAuthenticated: false, isLoading: true });
});

describe('protected navigation after router upgrade', () => {
  it('keeps the requested location when redirecting to login', async () => {
    useAuthStore.setState({ isAuthenticated: false, user: null });
    renderRoutes();
    expect(await screen.findByText('Login from /settings')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
  it('requires password rotation before opening a protected page', async () => {
    useAuthStore.setState({
      user: { id: 1, username: 'operator', role: 'admin', must_change_password: true },
    });
    renderRoutes();
    expect(await screen.findByText('Change password')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
  it('redirects a cashier away from administrator settings', async () => {
    useAuthStore.setState({ user: { id: 1, username: 'operator', role: 'cashier' } });
    renderRoutes();
    expect(await screen.findByText('Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Settings')).not.toBeInTheDocument();
  });
  it('opens settings for an authenticated administrator', () => {
    renderRoutes();
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
