import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/hooks/useTranslation';
import { AlertCircle, Eye, EyeOff, LogOut, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';

/** Mirrors MIN_PASSWORD_LENGTH on the server (config/security.ts). */
const MIN_PASSWORD_LENGTH = 12;

/**
 * Forced password rotation screen.
 *
 * Reached automatically after signing in with a provisioned/temporary password
 * (the server flags the account with `must_change_password` and rejects every
 * other endpoint until the flag is cleared).
 */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, changePassword, logout } = useAuthStore();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isForced = Boolean(user?.must_change_password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t('changePassword.tooShort'));
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(t('changePassword.mismatch'));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await changePassword(currentPassword, newPassword);
      toast.success(t('changePassword.success'));
      void navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || t('changePassword.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    logout();
    void navigate('/login', { replace: true });
  };

  const passwordInputType = showPasswords ? 'text' : 'password';

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">{t('changePassword.title')}</h1>
          <p className="mt-2 text-sm text-secondary">{t('changePassword.subtitle')}</p>
        </div>

        {isForced && (
          <div className="mb-5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-500">
            <span className="font-semibold">{user?.username}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="current-password" className="text-sm font-semibold text-foreground/80">
              {t('changePassword.current')}
            </label>
            <Input
              id="current-password"
              type={passwordInputType}
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={isSubmitting}
              required
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="new-password" className="text-sm font-semibold text-foreground/80">
              {t('changePassword.next')}
            </label>
            <Input
              id="new-password"
              type={passwordInputType}
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={isSubmitting}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="confirm-password" className="text-sm font-semibold text-foreground/80">
              {t('changePassword.confirm')}
            </label>
            <Input
              id="confirm-password"
              type={passwordInputType}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isSubmitting}
              required
              minLength={MIN_PASSWORD_LENGTH}
              className="h-11"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords((visible) => !visible)}
            className="flex items-center gap-2 text-xs font-medium text-secondary transition-colors hover:text-foreground"
          >
            {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>

          <Button type="submit" className="h-11 w-full" disabled={isSubmitting}>
            {isSubmitting ? t('changePassword.submitting') : t('changePassword.submit')}
          </Button>
        </form>

        <Button
          type="button"
          variant="ghost"
          onClick={handleLogout}
          className="mt-3 h-10 w-full text-secondary"
        >
          <LogOut className="mr-2 h-4 w-4" />
          {t('changePassword.logout')}
        </Button>
      </div>
    </div>
  );
}
