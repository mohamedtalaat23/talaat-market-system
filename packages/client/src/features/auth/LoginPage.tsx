import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/services/api-client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

import {
  Store,
  User,
  Lock,
  AlertCircle,
  Eye,
  EyeOff,
  BarChart3,
  Package,
  ShoppingCart,
  TrendingUp,
  Zap,
  Shield,
  Globe,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from '@/hooks/useTranslation';
import { usePreferences } from '@/contexts/preferencesContext';

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

const FEATURE_CARDS = [
  {
    icon: ShoppingCart,
    title: 'login.featureSmartPOS',
    description: 'login.featureSmartPOSDesc',
    color: 'from-emerald-400 to-teal-500',
    delay: '0ms',
  },
  {
    icon: Package,
    title: 'login.featureInventory',
    description: 'login.featureInventoryDesc',
    color: 'from-blue-400 to-cyan-500',
    delay: '100ms',
  },
  {
    icon: BarChart3,
    title: 'login.featureReports',
    description: 'login.featureReportsDesc',
    color: 'from-purple-400 to-violet-500',
    delay: '200ms',
  },
  {
    icon: TrendingUp,
    title: 'login.featureGrowth',
    description: 'login.featureGrowthDesc',
    color: 'from-orange-400 to-amber-500',
    delay: '300ms',
  },
];

export function LoginPage() {
  const { t } = useTranslation();
  const { language, toggleLanguage } = usePreferences();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);
  const { login, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as any)?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

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
      await new Promise((resolve) => setTimeout(resolve, 600));
      const response = await apiClient.post<LoginResponse>('/auth/login', { username, password });

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
    <div className="flex min-h-screen font-sans select-text bg-background">
      {/* ── Left Panel: Brand & Feature Showcase ─────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] flex-col justify-between relative overflow-hidden bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600 p-14">
        {/* Decorative shapes */}
        <div className="absolute -top-32 -right-32 h-[500px] w-[500px] rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-40 -left-20 h-[600px] w-[600px] rounded-full bg-black/10 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full border border-white/5 pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[400px] w-[400px] rounded-full border border-white/5 pointer-events-none" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.8) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />

        {/* Brand logo + name */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur border border-white/30 shadow-xl">
              <Store className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-white font-black text-xl tracking-tight leading-none">{t('login.talaatMarket')}</p>
              <p className="text-white/70 text-xs font-bold uppercase tracking-widest mt-0.5">{t('login.managementSystem')}</p>
            </div>
          </div>
        </div>

        {/* Hero text */}
        <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 rounded-full px-4 py-2 w-fit mb-6">
            <Zap className="h-4 w-4 text-yellow-300" />
            <span className="text-white text-xs font-bold uppercase tracking-widest">{t('login.retailPlatform')}</span>
          </div>
          <h1 className="text-5xl font-black text-white tracking-tight leading-tight mb-4">
            {t('login.runStore')}<br />
            <span className="text-white/80">{t('login.smarterFaster')}</span>
          </h1>
          <p className="text-white/80 text-lg font-medium leading-relaxed max-w-md">
            {t('login.heroDesc')}
          </p>

          {/* Feature cards grid */}
          <div className="grid grid-cols-2 gap-3 mt-10">
            {FEATURE_CARDS.map(({ icon: Icon, title, description, color, delay }) => (
              <div
                key={title}
                className="group bg-white/10 hover:bg-white/20 backdrop-blur border border-white/15 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg cursor-default"
                style={{ animationDelay: delay }}
              >
                <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${color} mb-3 shadow-md`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <p className="text-white font-bold text-sm leading-tight mb-1">{t(title)}</p>
                <p className="text-white/65 text-xs leading-snug">{t(description)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust badges */}
        <div className="relative z-10 flex items-center gap-6">
          <div className="flex items-center gap-2 text-white/70">
            <Shield className="h-4 w-4" />
            <span className="text-xs font-semibold">{t('login.secureEncrypted')}</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2 text-white/70">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-semibold">{t('login.realtimeSync')}</span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <div className="flex items-center gap-2 text-white/70">
            <Zap className="h-4 w-4" />
            <span className="text-xs font-semibold">{t('login.offlineReady')}</span>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Login Form ───────────────────────────────── */}
      <div className="flex flex-1 items-center justify-center bg-background p-8 relative overflow-hidden">
        {/* Language Toggle */}
        <div className="absolute top-6 right-6 rtl:right-auto rtl:left-6 z-20">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleLanguage}
            className="rounded-full gap-2 border-border/60 shadow-sm"
            type="button"
          >
            <Globe className="h-4 w-4 text-secondary" />
            <span className="font-semibold text-xs text-foreground uppercase">
              {language === 'ar' ? 'English' : 'عربي'}
            </span>
          </Button>
        </div>

        {/* Background glow (light mode: very soft) */}
        <div className="absolute top-0 right-0 h-[400px] w-[400px] rounded-full bg-primary/8 blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[300px] rounded-full bg-primary/5 blur-[80px] pointer-events-none" />

        <div className="w-full max-w-[400px] relative z-10">
          {/* Mobile-only brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg">
              <Store className="h-5 w-5" />
            </div>
            <div>
              <p className="text-foreground font-black text-lg tracking-tight leading-none">{t('login.talaatMarket')}</p>
              <p className="text-secondary text-[10px] font-bold uppercase tracking-widest mt-0.5">{t('login.managementSystem')}</p>
            </div>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h2 className="text-3xl font-black text-foreground tracking-tight mb-1">
              {t('login.title')}
            </h2>
            <p className="text-secondary text-sm font-medium">
              {t('login.enterCredentials')}
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/8 px-4 py-3 text-sm text-destructive mb-6 animate-in fade-in slide-in-from-top-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Username */}
            <div className="space-y-2">
              <label htmlFor="username" className="text-sm font-bold text-foreground/80">
                {t('login.username')}
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-4 rtl:pl-0 rtl:pr-4 text-secondary/50 group-focus-within:text-primary transition-colors duration-200">
                  <User className="h-5 w-5" />
                </span>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin..."
                  className="pl-12 rtl:pl-4 rtl:pr-12 h-13 rounded-xl text-base border-border/60 bg-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-border shadow-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  ref={usernameRef}
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-bold text-foreground/80">
                {t('login.password')}
              </label>
              <div className="relative group">
                <span className="absolute inset-y-0 left-0 rtl:left-auto rtl:right-0 flex items-center pl-4 rtl:pl-0 rtl:pr-4 text-secondary/50 group-focus-within:text-primary transition-colors duration-200">
                  <Lock className="h-5 w-5" />
                </span>
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  className="pl-12 pr-12 rtl:pl-12 rtl:pr-12 h-13 rounded-xl text-base border-border/60 bg-card focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all duration-200 hover:border-border shadow-sm"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 rtl:right-auto rtl:left-0 flex items-center pr-4 rtl:pr-0 rtl:pl-4 text-secondary/50 hover:text-foreground focus:outline-none transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-13 rounded-xl text-[15px] font-black tracking-wider uppercase bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-[0_4px_16px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_24px_rgba(16,185,129,0.4)] transition-all duration-300 hover:-translate-y-0.5 mt-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>{t('login.submitting')}</span>
                </div>
              ) : (
                t('login.submit')
              )}
            </Button>
          </form>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-secondary/60 font-medium">
            {t('login.copyright').replace('{year}', new Date().getFullYear().toString())}
          </p>
        </div>
      </div>
    </div>
  );
}
export default LoginPage;
