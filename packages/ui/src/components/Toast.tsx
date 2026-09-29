import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { cx } from '../lib/cx';

export type ToastVariant = 'default' | 'success' | 'error';

export interface ToastInput {
  title: string;
  description?: string | undefined;
  variant?: ToastVariant | undefined;
}

export interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

interface ToastItem {
  id: string;
  title: string;
  description?: string | undefined;
  variant: ToastVariant;
}

const TOAST_DURATION_MS = 5000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idCounter = useRef(0);
  const timers = useRef<number[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      idCounter.current += 1;
      const id = `gn-toast-${idCounter.current}`;
      const item: ToastItem = {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? 'default',
      };
      setItems((current) => [...current, item]);

      const timerId = window.setTimeout(() => {
        dismiss(id);
      }, TOAST_DURATION_MS);
      timers.current.push(timerId);
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timerId) => window.clearTimeout(timerId));
    };
  }, []);

  const value: ToastContextValue = { toast, dismiss };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="gn-toast__viewport"
        role="region"
        aria-live="polite"
        aria-label="Notificações"
      >
        {items.map((item) => (
          <div key={item.id} className={cx('gn-toast', `gn-toast--${item.variant}`)}>
            <div className="gn-toast__body">
              <p className="gn-toast__title">{item.title}</p>
              {item.description ? (
                <p className="gn-toast__description">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              className="gn-toast__close"
              aria-label="Fechar notificação"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used inside a ToastProvider');
  }

  return context;
}
