import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { usePOSStore } from '@/features/pos/usePOSStore';
import { apiClient } from '@/services/api-client';
import { useEmployees } from '@/features/employees/hooks/useEmployeeQueries';
import toast from 'react-hot-toast';
import { User, AlertTriangle, Users } from 'lucide-react';

interface FastPinLockscreenProps {
  isOpen: boolean;
  onSuccess: () => void;
}

export function FastPinLockscreen({ isOpen, onSuccess }: FastPinLockscreenProps) {
  const [pin, setPin] = useState('');
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingLogin, setPendingLogin] = useState<{ token: string; employee: any } | null>(null);

  const { user, login } = useAuthStore();
  const { cart, holdCurrentCart, clearCart } = usePOSStore();
  const { data: employeesData } = useEmployees({ page: 1, limit: 100, is_active: true });

  const activeEmployees = employeesData?.data || [];

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setSelectedUsername(null);
      setPendingLogin(null);
    }
  }, [isOpen]);

  const handlePinSubmit = useCallback(async (submittedPin: string) => {
    if (submittedPin.length < 4 || !selectedUsername) return;
    
    setIsLoading(true);
    try {
      const response = await apiClient.post('/auth/fast-pin', { username: selectedUsername, pin: submittedPin });
      if (response.data?.success && response.data.data) {
        const { token, employee } = response.data.data;
        
        // Check for active cart handoff
        if (user && employee.id !== user.id && cart.length > 0) {
          setPendingLogin({ token, employee });
        } else {
          login(token, employee);
          onSuccess();
          setPin('');
          setSelectedUsername(null);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid PIN');
      setPin('');
    } finally {
      setIsLoading(false);
    }
  }, [user, cart.length, login, onSuccess, selectedUsername]);

  // Auto-submit when 4 digits are reached
  useEffect(() => {
    if (pin.length === 4 && !isLoading && !pendingLogin) {
      handlePinSubmit(pin);
    }
  }, [pin, isLoading, pendingLogin, handlePinSubmit]);

  const handleKeypadPress = (digit: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleTakeOver = () => {
    if (pendingLogin) {
      login(pendingLogin.token, pendingLogin.employee);
      onSuccess();
      setPendingLogin(null);
      setPin('');
      toast.success(`Cart taken over by ${pendingLogin.employee.full_name}`);
    }
  };

  const handleSuspend = () => {
    if (pendingLogin && user) {
      holdCurrentCart(user.id);
      clearCart();
      login(pendingLogin.token, pendingLogin.employee);
      onSuccess();
      setPendingLogin(null);
      setPin('');
      toast.success(`Cart suspended for ${user.full_name}`);
    }
  };

  const handleCancel = () => {
    setPendingLogin(null);
    setPin('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        
        {pendingLogin ? (
          <div className="flex flex-col items-center space-y-6 animate-in fade-in zoom-in duration-200">
            <div className="rounded-full bg-amber-100 p-4">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-slate-900">Active Transaction</h2>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold">{user?.full_name}</span> has an active cart with {cart.length} items.
              </p>
            </div>
            
            <div className="flex w-full flex-col space-y-3">
              <button
                onClick={handleTakeOver}
                className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2"
              >
                Take Over Cart
              </button>
              <button
                onClick={handleSuspend}
                className="w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Suspend Cart & Start Fresh
              </button>
              <button
                onClick={handleCancel}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
              >
                Cancel Login
              </button>
            </div>
          </div>
        ) : !selectedUsername ? (
          <div className="flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <div className="rounded-full bg-indigo-50 p-4 mb-6">
              <Users className="h-8 w-8 text-indigo-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Select Cashier</h2>
            <p className="mt-2 mb-6 text-sm text-slate-500 text-center">
              Who is operating the register?
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
              {activeEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => setSelectedUsername(emp.username)}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 hover:border-indigo-300 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 group"
                >
                  <div className="h-12 w-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg font-bold mb-3 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    {emp.full_name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-slate-900 text-center line-clamp-1">{emp.full_name}</span>
                </button>
              ))}
            </div>
            {user && (
              <div className="mt-8 flex items-center justify-center space-x-2 text-sm text-slate-500">
                <User className="h-4 w-4" />
                <span>Currently: {user.full_name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in slide-in-from-right-8 duration-200">
            <div className="w-full flex justify-between items-center mb-6">
              <button
                onClick={() => setSelectedUsername(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
                title="Back to User Selection"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <div className="flex items-center space-x-2">
                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold">
                  {activeEmployees.find(e => e.username === selectedUsername)?.full_name.charAt(0).toUpperCase()}
                </div>
                <span className="font-semibold text-slate-900">
                  {activeEmployees.find(e => e.username === selectedUsername)?.full_name}
                </span>
              </div>
              <div className="w-6" /> {/* Spacer for centering */}
            </div>
            
            <h2 className="text-xl font-bold text-slate-900 mt-2">Enter PIN</h2>
            <div className="my-8 flex space-x-4">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`flex h-4 w-4 items-center justify-center rounded-full transition-all duration-200 ${
                    index < pin.length ? 'bg-indigo-600 scale-100' : 'bg-slate-200 scale-75'
                  }`}
                />
              ))}
            </div>

            <div className="grid w-full grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
                <button
                  key={digit}
                  onClick={() => handleKeypadPress(digit.toString())}
                  disabled={isLoading}
                  className="flex h-16 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-900 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50 transition-colors"
                >
                  {digit}
                </button>
              ))}
              <div />
              <button
                onClick={() => handleKeypadPress('0')}
                disabled={isLoading}
                className="flex h-16 items-center justify-center rounded-2xl bg-slate-50 text-2xl font-semibold text-slate-900 hover:bg-slate-100 active:bg-slate-200 disabled:opacity-50 transition-colors"
              >
                0
              </button>
              <button
                onClick={handleBackspace}
                disabled={isLoading || pin.length === 0}
                className="flex h-16 items-center justify-center rounded-2xl text-slate-500 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" x2="12" y1="9" y2="15"/><line x1="12" x2="18" y1="9" y2="15"/></svg>
              </button>
            </div>
            
            {user && selectedUsername === user.username && (
              <div className="mt-8 flex items-center justify-center space-x-2 text-sm text-slate-500">
                <User className="h-4 w-4" />
                <span>Currently Active User</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
