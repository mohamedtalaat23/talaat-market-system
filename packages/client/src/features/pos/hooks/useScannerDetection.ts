import { useEffect, useRef } from 'react';

interface UseScannerDetectionProps {
  onScan: (barcode: string) => void;
  timeThreshold?: number; // max ms between keystrokes to be considered a scanner
}

export function useScannerDetection({ onScan, timeThreshold = 30 }: UseScannerDetectionProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore key events if the user is typing in a real input/textarea,
      // UNLESS we want to capture scans globally anyway. 
      // Typically, in a POS, if they scan, it should always trigger a scan
      // even if they are focused in an input. But we should be careful.
      // We will capture globally unless the input specifically stops propagation.

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // If the time between keystrokes is larger than the threshold,
      // it means a human is typing, so we reset the buffer.
      if (timeDiff > timeThreshold) {
        bufferRef.current = '';
      }

      if (e.key === 'Enter' && bufferRef.current.length > 0) {
        // Scanner finished scanning
        const scannedCode = bufferRef.current;
        bufferRef.current = '';
        
        // Prevent form submissions or other Enter behaviors
        e.preventDefault();
        
        // Trigger callback
        onScan(scannedCode);
        return;
      }

      // If it's a printable character, add it to the buffer
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }

      lastKeyTimeRef.current = currentTime;
    };

    window.addEventListener('keydown', handleKeyDown, true); // use capture phase to intercept before inputs

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [onScan, timeThreshold]);
}
