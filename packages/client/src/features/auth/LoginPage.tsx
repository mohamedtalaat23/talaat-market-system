import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card';
import { Store, User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface LoginResponse {
  success: boolean;
  data: {
    token: string;
    employee: {
      id: number;
      username: string;
      role: 'admin' | 'manager' | 'cashier';
      full_name: string;
    };
  };
}

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if already logged in
  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  // Focus username input on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Please fill in all fields');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Artificial delay to prevent timing attacks and show loading state cleanly
      await new Promise(resolve => setTimeout(resolve, 600));

      const response = await apiClient.post<LoginResponse>('/auth/login', {
        username,
        password,
      });

      if (response.data?.success && response.data?.data) {
        const { token, employee } = response.data.data;
        login(token, {
          id: employee.id,
          username: employee.username,
          role: employee.role,
          full_name: employee.full_name,
        });
        toast.success(`Welcome back, ${employee.full_name}!`);
        navigate(from, { replace: true });
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4 font-sans select-text">
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-indigo-500/5 blur-3xl" />

      <Card className="w-full max-w-md border-neutral-800 bg-neutral-900/40 backdrop-blur-md relative z-10">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight mt-3">Talaat Market</CardTitle>
          <CardDescription className="text-neutral-400">
            Supermarket Administration Panel
          </CardDescription>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center space-x-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-neutral-300">
                Username
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin, manager..."
                  className="pl-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  ref={usernameRef}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-neutral-300">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="pl-10 pr-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-500 hover:text-neutral-300 focus:outline-none focus:text-neutral-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2">
            <Button
              type="submit"
              className="w-full font-semibold"
              disabled={isLoading}
            >
              {isLoading ? 'Authenticating...' : 'Log In'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
export default LoginPage;
