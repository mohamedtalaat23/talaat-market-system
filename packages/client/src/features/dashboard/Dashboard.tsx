import { useQuery } from '@tanstack/react-query';
import { Activity, Database, Clock, Server } from 'lucide-react';
import { api } from '@/services/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import type { HealthData } from '@/types';
import styles from './Dashboard.module.css';

/**
 * Dashboard — Phase 1 placeholder.
 *
 * Currently shows the server health status.
 * In Phase 4, this will display KPIs, charts, and business intelligence.
 */
export function Dashboard() {
  const { data: health, isLoading, error } = useQuery<HealthData>({
    queryKey: ['health'],
    queryFn: () => api.get<HealthData>('/health'),
    refetchInterval: 30_000, // Refresh every 30 seconds
  });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Dashboard</h2>
        <p className={styles.subtitle}>System status and overview</p>
      </div>

      {isLoading && (
        <div className={styles.center}>
          <LoadingSpinner label="Connecting to server..." />
        </div>
      )}

      {error instanceof Error && (
        <div className={styles.errorCard}>
          <p className={styles.errorTitle}>⚠️ Server Unreachable</p>
          <p className={styles.errorMsg}>{error.message}</p>
          <p className={styles.errorHint}>
            Make sure the Express server is running on port 3001.
          </p>
        </div>
      )}

      {health && (
        <>
          {/* Status banner */}
          <div className={`${styles.statusBanner} ${health.status === 'healthy' ? styles.statusOk : styles.statusDegraded}`}>
            <Activity size={18} />
            <span>
              System is <strong>{health.status}</strong> — {health.environment} environment
            </span>
          </div>

          {/* Stats grid */}
          <div className={styles.statsGrid}>
            <div className={styles.statCard}>
              <div className={styles.statIcon}><Server size={20} /></div>
              <div>
                <p className={styles.statLabel}>API Server</p>
                <p className={styles.statValue}>Online</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={`${styles.statIcon} ${health.services.database.status === 'connected' ? styles.iconSuccess : styles.iconDanger}`}>
                <Database size={20} />
              </div>
              <div>
                <p className={styles.statLabel}>Database</p>
                <p className={styles.statValue}>
                  {health.services.database.status === 'connected'
                    ? `${health.services.database.latencyMs ?? 0}ms`
                    : 'Disconnected'}
                </p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}><Clock size={20} /></div>
              <div>
                <p className={styles.statLabel}>Uptime</p>
                <p className={styles.statValue}>{Math.floor(health.uptime / 60)}m {health.uptime % 60}s</p>
              </div>
            </div>

            <div className={styles.statCard}>
              <div className={styles.statIcon}><Activity size={20} /></div>
              <div>
                <p className={styles.statLabel}>Response Time</p>
                <p className={styles.statValue}>{health.responseTimeMs}ms</p>
              </div>
            </div>
          </div>

          {/* Placeholder message */}
          <div className={styles.placeholder}>
            <h3>🚧 Phase 1 — Foundation Complete</h3>
            <p>
              The project scaffold is ready. Business features (POS, inventory, reports)
              will be implemented in Phases 2–6.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
