import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState } from '../src';

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="Nenhum projeto" description="Crie o primeiro projeto" />);

    expect(screen.getByText('Nenhum projeto')).toBeInTheDocument();
    expect(screen.getByText('Crie o primeiro projeto')).toBeInTheDocument();
  });

  it('renders the optional action', () => {
    render(
      <EmptyState
        title="Nenhum projeto"
        action={<button type="button">Novo projeto</button>}
      />,
    );

    expect(screen.getByRole('button', { name: 'Novo projeto' })).toBeInTheDocument();
  });

  it('omits description and action when not provided', () => {
    render(<EmptyState title="Sem camadas" />);

    expect(screen.getByText('Sem camadas')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('uses the default title', () => {
    render(<ErrorState />);

    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
  });

  it('renders a custom title and message', () => {
    render(<ErrorState title="Falha na API" message="Nao foi possivel carregar" />);

    expect(screen.getByText('Falha na API')).toBeInTheDocument();
    expect(screen.getByText('Nao foi possivel carregar')).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is pressed', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when there is no callback', () => {
    render(<ErrorState message="Erro" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
