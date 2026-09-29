import type { ReactNode } from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string | undefined;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="gn-empty">
      <p className="gn-empty__title">{title}</p>
      {description ? <p className="gn-empty__description">{description}</p> : null}
      {action ? <div className="gn-empty__action">{action}</div> : null}
    </div>
  );
}
