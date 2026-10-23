import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

import { Disclaimer } from '../ui/Disclaimer';
import styles from './AppShell.module.css';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', end: true },
  { to: '/mandi-prices', label: 'Mandi Prices', end: false },
  { to: '/crop-suggestions', label: 'Crop Suggestions', end: false },
  { to: '/data-sources', label: 'Data Sources & About', end: false },
] as const;

/**
 * The shared page frame: header, primary navigation, main landmark, and footer.
 *
 * The disclaimer is rendered in the footer on every route so it is always
 * reachable (PRD section 13).
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.brand}>
            <span className={styles.brandMark} aria-hidden="true">
              🌾
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandName}>Krishi Mandi Platform</span>
              <span className={styles.brandTagline}>
                Crop suggestion and mandi price information
              </span>
            </span>
          </div>

          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  isActive ? `${styles.navLink} ${styles.navLinkActive}` : styles.navLink
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className={styles.main} id="main-content">
        {children}
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <Disclaimer />
          <p className={styles.footerNote}>
            Krishi Mandi Price Prediction &amp; Crop Suggestion Platform. Data shown in
            this MVP is demonstration data unless a card explicitly says otherwise.
          </p>
        </div>
      </footer>
    </div>
  );
}
