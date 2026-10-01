import type { ReactNode } from 'react';

const Icon = ({ d }: { d: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="28"
    height="28"
    aria-hidden="true"
    className="state-icon"
  >
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <p role="status" className="state">
    {label}
  </p>
);

/** Placeholder rows with the shape of the real list, so the layout does not jump on load. */
export const ListSkeleton = ({ label = 'Loading stock…' }: { label?: string }) => (
  <div>
    <p role="status" className="muted">
      {label}
    </p>
    <ul className="items" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="item skeleton">
          <span className="sk sk-img" />
          <span className="item-main">
            <span className="sk sk-line" />
            <span className="sk sk-line short" />
          </span>
        </li>
      ))}
    </ul>
  </div>
);

/** Placeholder with the shape of the item page, so the layout does not jump on load. */
export const DetailSkeleton = ({ label = 'Loading item…' }: { label?: string }) => (
  <div className="detail">
    <p role="status" className="muted">
      {label}
    </p>
    <div className="card detail-main" aria-hidden="true">
      <span className="sk sk-detail-img" />
      <div>
        <span className="sk sk-line short" />
        <span className="sk sk-line" />
        <span className="sk sk-line" />
      </div>
    </div>
  </div>
);

export const Empty = ({ children }: { children: ReactNode }) => (
  <div className="card state">
    <Icon d="M4 7h16M4 12h10M4 17h6" />
    {children}
  </div>
);

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div role="alert" className="card state error">
      <Icon d="M12 8v5M12 17h.01M10.3 3.9 2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <p>{message}</p>
      <button type="button" className="primary" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
