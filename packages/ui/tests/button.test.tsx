import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '../src';

describe('Button', () => {
  it('renders its children', () => {
    render(<Button>Salvar</Button>);

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('applies the primary variant by default', () => {
    render(<Button>Primario</Button>);

    expect(screen.getByRole('button')).toHaveClass('gn-button--primary');
  });

  it('applies explicit variant and size', () => {
    render(
      <Button variant="destructive" size="sm">
        Excluir
      </Button>,
    );

    const button = screen.getByRole('button', { name: 'Excluir' });

    expect(button).toHaveClass('gn-button--destructive');
    expect(button).toHaveClass('gn-button--sm');
  });

  it('is disabled when the disabled prop is set', () => {
    render(<Button disabled>Desativado</Button>);

    expect(screen.getByRole('button', { name: 'Desativado' })).toBeDisabled();
  });

  it('is busy, disabled and renders a spinner while loading', () => {
    render(<Button loading>Salvando</Button>);

    const button = screen.getByRole('button', { name: 'Salvando' });

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('.gn-button__spinner')).not.toBeNull();
  });
});
