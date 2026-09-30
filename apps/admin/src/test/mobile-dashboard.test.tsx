import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const projects = [
  { id: '00000000-0000-4000-8000-000000000001', name: 'Recent Survey', description: 'Current field work', status: 'active', updatedAt: '2026-09-30T00:00:00.000Z' },
  { id: '00000000-0000-4000-8000-000000000002', name: 'Older Survey', description: null, status: 'active', updatedAt: '2026-09-01T00:00:00.000Z' },
];

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to: string; params?: Record<string, string> }) => {
    const href = params?.projectId ? to.replace('$projectId', params.projectId) : to;
    return <a href={href} {...props}>{children}</a>;
  },
}));
vi.mock('../lib/hooks/projects', () => ({
  useProjectPages: () => ({ data: { items: projects }, isLoading: false, isError: false, hasNextPage: false }),
}));

import { MobileDashboard } from '../components/dashboard/MobileDashboard';

describe('MobileDashboard', () => {
  beforeEach(() => { Object.defineProperty(navigator, 'onLine', { configurable: true, value: true }); });

  it('renders saved projects and real navigation actions', () => {
    render(<MobileDashboard />);
    expect(screen.getByText('Recent Survey')).toBeVisible();
    expect(screen.getAllByRole('link', { name: 'Mapa' }).some((link) => link.getAttribute('href') === '/workspace')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Malha 3D' })[0]).toHaveAttribute('href', '/projects/00000000-0000-4000-8000-000000000001/mesh');
  });

  it('filters and changes project ordering', () => {
    render(<MobileDashboard />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar projetos' }), { target: { value: 'Older' } });
    expect(screen.getByText('Older Survey')).toBeVisible();
    expect(screen.queryByText('Recent Survey')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Ordenar/ }));
  });
});
