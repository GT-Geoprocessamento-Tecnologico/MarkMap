import { useId } from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { cx } from '../lib/cx';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean | undefined;
}

export interface SelectProps {
  label?: string | undefined;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string | undefined;
  disabled?: boolean | undefined;
  error?: string | undefined;
}

const CHECK_MARK = '✓';

export function Select({
  label,
  value,
  onValueChange,
  options,
  placeholder,
  disabled = false,
  error,
}: SelectProps) {
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const errorId = `${baseId}-error`;
  const invalid = typeof error === 'string' && error.length > 0;

  return (
    <div className="gn-field">
      {label ? (
        <span className="gn-field__label" id={labelId}>
          {label}
        </span>
      ) : null}
      <SelectPrimitive.Root value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectPrimitive.Trigger
          className="gn-select__trigger"
          {...(label ? { 'aria-labelledby': labelId } : {})}
          {...(invalid ? { 'aria-describedby': errorId, 'aria-invalid': true } : {})}
        >
          <SelectPrimitive.Value placeholder={placeholder} />
          <SelectPrimitive.Icon className="gn-select__icon" />
        </SelectPrimitive.Trigger>
        <SelectPrimitive.Portal>
          <SelectPrimitive.Content
            className="gn-select__content"
            position="popper"
            sideOffset={4}
          >
            <SelectPrimitive.Viewport className="gn-select__viewport">
              {options.map((option) => (
                <SelectPrimitive.Item
                  key={option.value}
                  value={option.value}
                  className="gn-select__item"
                  {...(option.disabled ? { disabled: true } : {})}
                >
                  <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator className="gn-select__item-indicator">
                    {CHECK_MARK}
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </SelectPrimitive.Viewport>
          </SelectPrimitive.Content>
        </SelectPrimitive.Portal>
      </SelectPrimitive.Root>
      {invalid ? (
        <p className="gn-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
