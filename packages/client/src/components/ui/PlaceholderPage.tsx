import { Construction } from 'lucide-react';
import styles from './Placeholder.module.css';

interface PlaceholderPageProps {
  title: string;
  description: string;
  phase: string;
}

/**
 * Placeholder page — shown for features not yet implemented.
 * Will be replaced by real implementations in later phases.
 */
export function PlaceholderPage({ title, description, phase }: PlaceholderPageProps) {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <Construction size={40} strokeWidth={1.5} />
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>
        <div className={styles.phaseBadge}>
          <span>Coming in {phase}</span>
        </div>
      </div>
    </div>
  );
}
