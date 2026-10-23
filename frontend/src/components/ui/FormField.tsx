import { useId } from 'react';
import type { ReactNode } from 'react';

import styles from './FormField.module.css';

export type FormFieldProps = {
  label: string;
  /** Shown after the label and announced as required by screen readers. */
  required?: boolean;
  hint?: string;
  error?: string;
  children: (controlProps: {
    id: string;
    'aria-describedby': string | undefined;
    'aria-invalid': boolean | undefined;
    invalid: boolean;
  }) => ReactNode;
};

/**
 * Wraps a single form control and wires up the label, hint, and error text to it.
 *
 * The control is passed as a function so the generated ids stay linked without
 * the caller having to manage them.
 */
export function FormField({ label, required = false, hint, error, children }: FormFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
        {required ? <span className="visually-hidden"> (required)</span> : null}
      </label>

      {children({
        id,
        'aria-describedby': describedBy ? describedBy : undefined,
        'aria-invalid': error ? true : undefined,
        invalid: Boolean(error),
      })}

      {hint ? (
        <span className={styles.hint} id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className={styles.error} id={errorId}>
          {error}
        </span>
      ) : null}
    </div>
  );
}

type ControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': boolean | undefined;
  invalid: boolean;
};

function controlClassName(base: string, invalid: boolean): string {
  return invalid ? `${base} ${styles.invalid}` : base;
}

export type TextFieldProps = Omit<FormFieldProps, 'children'> & {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: 'text' | 'numeric' | 'decimal';
};

export function TextField({
  value,
  onChange,
  placeholder,
  inputMode,
  ...field
}: TextFieldProps) {
  return (
    <FormField {...field}>
      {({ invalid, ...control }: ControlProps) => (
        <input
          {...control}
          className={controlClassName(styles.input, invalid)}
          type="text"
          value={value}
          placeholder={placeholder}
          inputMode={inputMode}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </FormField>
  );
}

export type SelectOption = { value: string; label: string };

export type SelectFieldProps = Omit<FormFieldProps, 'children'> & {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export function SelectField({
  value,
  options,
  onChange,
  placeholder,
  ...field
}: SelectFieldProps) {
  return (
    <FormField {...field}>
      {({ invalid, ...control }: ControlProps) => (
        <select
          {...control}
          className={controlClassName(styles.select, invalid)}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  );
}
