import { useEffect, useRef } from 'react';

interface UseScannerDetectionProps {
  onScan: (barcode: string) => void;
  timeThreshold?: number; // max ms between keystrokes to be considered a scanner (e.g. 30ms)
  minBarcodeLength?: number;
  maxBarcodeLength?: number;
}

export function useScannerDetection({
  onScan,
  timeThreshold = 30,
  minBarcodeLength = 3,
  maxBarcodeLength = 50,
}: UseScannerDetectionProps) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const scanCooldownRef = useRef<number>(0); // Cooldown to throttle consecutive scans

  // 1. Maintain a stable callback ref that updates on every render
  const onScanRef = useRef(onScan);
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent standard functional keyboard shortcuts from entering scanner buffer
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // Ignore standard non-printable keys (except Enter)
      if (e.key.length > 1 && e.key !== 'Enter') {
        return;
      }

      const currentTime = performance.now();
      const timeDiff = currentTime - lastKeyTimeRef.current;

      // 2. Human typing filter:
      // If the time between keystrokes is larger than the threshold,
      // it means a human is typing, so we reset the buffer.
      // Exception: the first character in the buffer will have a large timeDiff,
      // so we only reset the buffer if the buffer already has characters.
      if (bufferRef.current.length > 0 && timeDiff > timeThreshold) {
        bufferRef.current = '';
      }

      // 3. Enter key marks scanner input completion
      if (e.key === 'Enter') {
        const scannedCode = bufferRef.current.trim();
        bufferRef.current = '';

        if (scannedCode.length >= minBarcodeLength && scannedCode.length <= maxBarcodeLength) {
          // Prevent default form submission / action
          e.preventDefault();
          e.stopPropagation();

          // 4. Rate limiting: prevent UI freezing by throttling rapid consecutive scans (e.g. 150ms cooldown)
          if (currentTime - scanCooldownRef.current > 150) {
            scanCooldownRef.current = currentTime;
            onScanRef.current(scannedCode);
          } else {
            console.warn('[Scanner] Scan ignored due to rate limiting cooldown.');
          }
        }
        return;
      }

      // 4. Flood Guard (corrupt input stream prevention)
      // If characters arrive with literally 0ms or sub-millisecond gaps (e.g., < 1ms),
      // it is a corrupt input flood or machine issue, so we drop it.
      if (bufferRef.current.length > 0 && timeDiff < 1) {
        bufferRef.current = '';
        lastKeyTimeRef.current = currentTime;
        return;
      }

      // 5. Append printable character to buffer if within length bounds
      if (e.key.length === 1) {
        if (bufferRef.current.length < maxBarcodeLength) {
          bufferRef.current += e.key;
        } else {
          // Wiped due to overflow (prevent continuous corrupted buffer memory leaks)
          bufferRef.current = '';
        }
      }

      lastKeyTimeRef.current = currentTime;
    };

    // Use capture phase to intercept scanner keystrokes before any browser input handles them
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [timeThreshold, minBarcodeLength, maxBarcodeLength]); // stable onScan callback excluded from dependencies
}
