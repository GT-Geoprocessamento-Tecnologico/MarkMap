import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from '../App';

describe('App shell', () => {
  it('renderiza shell, navegacao principal e footer obrigatorio', async () => {
    render(<App />);

    expect(await screen.findByRole('navigation', { name: 'Navegação principal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Projetos' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: 'Importações' })).toHaveAttribute('href', '/imports');
    expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/settings');

    expect(screen.getByText('Desenvolvido por MtsFerreira')).toBeInTheDocument();
    const footerLink = screen.getByRole('link', { name: 'https://mtsferreira.dev' });
    expect(footerLink).toHaveAttribute('href', 'https://mtsferreira.dev');
    expect(footerLink).toHaveAttribute('target', '_blank');
    expect(footerLink).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
