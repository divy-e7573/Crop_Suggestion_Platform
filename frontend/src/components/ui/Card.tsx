import type { ReactNode } from 'react';

import styles from './Card.module.css';

export type CardProps = {
  title: string;
  description?: string;
  /** Renders a dashed card used to show planned but unbuilt features. */
  muted?: boolean;
  /** Rendered on the right of the header, typically a status badge. */
  aside?: ReactNode;
  children: ReactNode;
};

export function Card({ title, description, muted = false, aside, children }: CardProps) {
  const className = muted ? `${styles.card} ${styles.muted}` : styles.card;

  return (
    <section className={className}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{title}</h2>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {aside}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
