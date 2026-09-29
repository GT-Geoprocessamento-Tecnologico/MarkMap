import { useId } from 'react';
import * as CheckboxPrimitive from '@radix-ui/react-checkbox';

export interface CheckboxProps {
  label?: string | undefined;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean | undefined;
}

export function Checkbox({ label, checked, onCheckedChange, disabled }: CheckboxProps) {
  const controlId = useId();

  return (
    <label className="gn-checkbox" htmlFor={controlId}>
      <CheckboxPrimitive.Root
        id={controlId}
        className="gn-checkbox__control"
        checked={checked}
        onCheckedChange={(next) => onCheckedChange(next === true)}
        {...(disabled ? { disabled: true } : {})}
      >
        <CheckboxPrimitive.Indicator className="gn-checkbox__indicator">
          ✓
        </CheckboxPrimitive.Indicator>
      </CheckboxPrimitive.Root>
      {label ? <span className="gn-checkbox__label">{label}</span> : null}
    </label>
  );
}
