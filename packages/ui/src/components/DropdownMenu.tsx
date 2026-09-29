import type { ComponentPropsWithoutRef } from 'react';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { cx } from '../lib/cx';

const DropdownMenu = DropdownMenuPrimitive.Root;
const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;

export type DropdownMenuContentProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Content
>;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...rest
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        className={cx('gn-menu__content', className)}
        sideOffset={sideOffset}
        {...rest}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export type DropdownMenuItemProps = ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>;

export function DropdownMenuItem({ className, ...rest }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cx('gn-menu__item', className)}
      {...rest}
    />
  );
}

export type DropdownMenuSeparatorProps = ComponentPropsWithoutRef<
  typeof DropdownMenuPrimitive.Separator
>;

export function DropdownMenuSeparator({
  className,
  ...rest
}: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cx('gn-menu__separator', className)}
      {...rest}
    />
  );
}

export { DropdownMenu, DropdownMenuTrigger };
