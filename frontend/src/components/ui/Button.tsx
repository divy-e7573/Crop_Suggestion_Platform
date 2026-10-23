import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

import styles from './Button.module.css';

type ButtonVariant = 'primary' | 'secondary' | 'ghost';
type ButtonSize = 'sm' | 'md';

function classNames(
  base: string,
  variant: ButtonVariant,
  size: ButtonSize,
  block: boolean,
  extra?: string,
): string {
  return [base, styles[variant], styles[size], block ? styles.block : '', extra]
    .filter(Boolean)
    .join(' ');
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
};

/** A real <button>. Use this for actions such as retry or submit. */
export function Button({
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  type = 'button',
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames(styles.button, variant, size, block, className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export type LinkButtonProps = {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
};

/** An in-app navigation link styled as a button. */
export function LinkButton({
  to,
  variant = 'primary',
  size = 'md',
  block = false,
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link to={to} className={classNames(styles.linkButton, variant, size, block, className)}>
      {children}
    </Link>
  );
}
