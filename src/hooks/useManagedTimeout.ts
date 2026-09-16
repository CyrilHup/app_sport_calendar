import { useCallback, useEffect, useRef } from 'react';

/** Schedules component-owned timers and cancels every pending callback on unmount. */
export function useManagedTimeout(): (callback: () => void, delayMs: number) => void {
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => () => {
    for (const timer of timersRef.current) clearTimeout(timer);
    timersRef.current.clear();
  }, []);

  return useCallback((callback: () => void, delayMs: number) => {
    const timer = setTimeout(() => {
      timersRef.current.delete(timer);
      callback();
    }, delayMs);
    timersRef.current.add(timer);
  }, []);
}
