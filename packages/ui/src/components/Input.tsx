import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  error?: string | undefined;
}

export function Input({ label, error, id, className, ...rest }: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const invalid = typeof error === 'string' && error.length > 0;

  return (
    <div className="gn-field">
      {label ? (
        <label className="gn-field__label" htmlFor={inputId}>
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={inputId}
        className={cx('gn-input', invalid && 'gn-input--invalid', className)}
        aria-invalid={invalid}
        {...(invalid ? { 'aria-describedby': errorId } : {})}
      />
      {invalid ? (
        <p className="gn-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
