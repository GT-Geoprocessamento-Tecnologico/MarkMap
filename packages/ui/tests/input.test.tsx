import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '../src';

describe('Input', () => {
  it('renders a label associated with the field', () => {
    render(<Input label="Nome" />);

    const input = screen.getByLabelText('Nome');

    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(input).not.toHaveAttribute('aria-describedby');
  });

  it('wires the error message through aria-describedby', () => {
    render(<Input label="Nome" error="Campo obrigatorio" />);

    const input = screen.getByLabelText('Nome');
    const errorNode = screen.getByText('Campo obrigatorio');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input.getAttribute('aria-describedby')).toBe(errorNode.id);
    expect(errorNode.id).not.toBe('');
  });

  it('does not render an error node when the message is empty', () => {
    const { container } = render(<Input label="Nome" error="" />);

    const input = screen.getByLabelText('Nome');

    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(container.querySelector('.gn-field__error')).toBeNull();
  });
});
