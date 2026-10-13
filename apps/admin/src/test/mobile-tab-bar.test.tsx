import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useRouterState: ({ select }: { select: (state: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: '/workspace' } }),
}));

import { MobileTabBar } from '../components/layout/MobileTabBar';

describe('MobileTabBar', () => {
  it('exposes the four primary destinations with the active tab marked', () => {
    render(<MobileTabBar />);
    expect(screen.getByRole('navigation', { name: 'Navegação principal do aplicativo' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('href', '/workspace');
    expect(screen.getByRole('link', { name: 'Projetos' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Dados' })).toHaveAttribute('href', '/imports');
    expect(screen.getByRole('link', { name: 'Ajustes' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
  });
});
