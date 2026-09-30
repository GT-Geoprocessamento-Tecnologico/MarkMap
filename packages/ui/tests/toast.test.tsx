import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from '../src';

function ToastTrigger() {
  const { toast } = useToast();

  return (
    <button
      type="button"
      onClick={() =>
        toast({
          title: 'Projeto salvo',
          description: 'Alteracoes persistidas',
          variant: 'success',
        })
      }
    >
      avisar
    </button>
  );
}

describe('Toast', () => {
  it('exposes an aria-live polite viewport', () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    expect(screen.getByRole('region')).toHaveAttribute('aria-live', 'polite');
  });

  it('shows a toast with title and description', async () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));

    expect(screen.getByText('Projeto salvo')).toBeInTheDocument();
    expect(screen.getByText('Alteracoes persistidas')).toBeInTheDocument();
  });

  it('dismisses a toast through the close button', async () => {
    render(
      <ToastProvider>
        <ToastTrigger />
      </ToastProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'avisar' }));
    expect(screen.getByText('Projeto salvo')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Fechar notificação' }));

    await waitFor(() => {
      expect(screen.queryByText('Projeto salvo')).not.toBeInTheDocument();
    });
  });
});
