import type { ComponentPropsWithoutRef } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { cx } from '../lib/cx';

const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;

export type TooltipContentProps = ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...rest
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        className={cx('gn-tooltip__content', className)}
        sideOffset={sideOffset}
        {...rest}
      />
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger };
