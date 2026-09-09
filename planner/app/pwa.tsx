'use client';
import { useEffect } from 'react';

export function Pwa() {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      void navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {
          // Installation is optional and must never interrupt budgeting.
        });
    }
  }, []);
  return null;
}
