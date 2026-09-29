import { Button } from './Button';

export interface ErrorStateProps {
  title?: string | undefined;
  message?: string | undefined;
  onRetry?: (() => void) | undefined;
}

export function ErrorState({
  title = 'Algo deu errado',
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="gn-error-state" role="alert">
      <p className="gn-error-state__title">{title}</p>
      {message ? <p className="gn-error-state__message">{message}</p> : null}
      {onRetry ? (
        <div className="gn-empty__action">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}
    </div>
  );
}
