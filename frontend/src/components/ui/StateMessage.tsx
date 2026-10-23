import type { ReactNode } from 'react';

import styles from './StateMessage.module.css';
import { Button } from './Button';

export type StateMessageProps = {
  kind: 'loading' | 'empty' | 'error';
  title: string;
  detail?: string;
  /** Supplying this renders a retry button, so it is never inert. */
  onRetry?: () => void;
  children?: ReactNode;
};

/**
 * One component for the loading, empty, and error states required by the PRD.
 *
 * `role` is chosen so assistive technology announces the change: a loading or
 * empty result is a polite status, an error is an assertive alert.
 */
export function StateMessage({
  kind,
  title,
  detail,
  onRetry,
  children,
}: StateMessageProps) {
  const isError = kind === 'error';
  const role = isError ? 'alert' : 'status';
  const className = isError ? `${styles.state} ${styles.error}` : styles.state;

  return (
    <div className={className} role={role} aria-live={isError ? 'assertive' : 'polite'}>
      {kind === 'loading' ? (
        <div aria-hidden="true">
          <div className={`${styles.bar} ${styles.barShort}`} />
          <div className={`${styles.bar} ${styles.barLong}`} />
        </div>
      ) : null}

      <p className={styles.title}>{title}</p>
      {detail ? <p className={styles.detail}>{detail}</p> : null}
      {children}
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
