import styles from './LoadingSpinner.module.css';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

/**
 * LoadingSpinner — displayed during initial load, route transitions,
 * and async operations. Uses CSS animation for performance (no JS).
 */
export function LoadingSpinner({ size = 'md', label = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <div className={`${styles.wrapper} ${styles[size]}`} role="status" aria-label={label}>
      <div className={styles.spinner} />
      {label && <span className={styles.label}>{label}</span>}
    </div>
  );
}
