import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/Card';
import { Store, User, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '@/hooks/useTranslation';

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
  const { t } = useTranslation();
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
      setError(t('login.error'));
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Artificial delay to prevent timing attacks and show loading state cleanly
      await new Promise((resolve) => setTimeout(resolve, 600));

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
        setError(t('login.error'));
      }
    } catch (err: any) {
      setError(err.message || t('login.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 font-sans select-text">
      {/* Visual background accents */}
      <div className="absolute top-1/4 left-1/4 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />

      <Card className="w-full max-w-md border-border bg-card/60 backdrop-blur-md relative z-10">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight mt-3">
            {t('login.title')}
          </CardTitle>
          <CardDescription className="text-secondary">{t('login.subtitle')}</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="flex items-center space-x-2 rtl:space-x-reverse rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive animate-fade-in">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5 text-left rtl:text-right">
              <label htmlFor="username" className="text-sm font-medium text-secondary">
                {t('login.username')}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3 rtl:pl-0 rtl:pr-3 text-neutral-500">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin..."
                  className="pl-10 rtl:pl-3 rtl:pr-10"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  ref={usernameRef}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left rtl:text-right">
              <label htmlFor="password" className="text-sm font-medium text-secondary">
                {t('login.password')}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-3 rtl:pl-0 rtl:pr-3 text-neutral-500">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
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
                  className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-3 rtl:pr-0 rtl:pl-3 text-secondary hover:text-foreground focus:outline-none focus:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2">
            <Button type="submit" className="w-full font-semibold" disabled={isLoading}>
              {isLoading ? t('login.submitting') : t('login.submit')}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
export default LoginPage;
