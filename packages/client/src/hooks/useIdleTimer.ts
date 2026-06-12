import { useState, useEffect, useCallback } from 'react';

export function useIdleTimer(timeoutMs: number | null) {
  const [isIdle, setIsIdle] = useState(false);

  const resetTimer = useCallback(() => {
    setIsIdle(false);
  }, []);

  useEffect(() => {
    if (timeoutMs === null || timeoutMs <= 0) {
      setIsIdle(false);
      return;
    }

    let timeoutId: number;

    const handleActivity = () => {
      setIsIdle(false);
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsIdle(true);
      }, timeoutMs);
    };

    // Initial setup
    handleActivity();

    const events = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((event) => {
      window.addEventListener(event, handleActivity);
    });

    return () => {
      window.clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [timeoutMs]);

  return { isIdle, resetTimer, setIsIdle };
}
