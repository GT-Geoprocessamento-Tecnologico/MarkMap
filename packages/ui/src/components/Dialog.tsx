import type { ComponentPropsWithoutRef, HTMLAttributes } from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { cx } from '../lib/cx';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogClose = DialogPrimitive.Close;
const DialogTitle = DialogPrimitive.Title;
const DialogDescription = DialogPrimitive.Description;

export type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content>;

export function DialogContent({ className, children, ...rest }: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="gn-dialog__overlay" />
      <DialogPrimitive.Content
        className={cx('gn-dialog__content', className)}
        {...rest}
      >
        {children}
        <DialogPrimitive.Close className="gn-dialog__close" aria-label="Fechar">
          <span aria-hidden="true">×</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('gn-dialog__header', className)} {...rest} />;
}

export function DialogFooter({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('gn-dialog__footer', className)} {...rest} />;
}

export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogTitle,
  DialogDescription,
};
