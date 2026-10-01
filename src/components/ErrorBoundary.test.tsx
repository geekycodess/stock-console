import { act, type ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const Boom = (): ReactElement => {
  throw new Error('boom');
};

function mount(node: ReactElement) {
  const el = document.createElement('div');
  document.body.append(el);
  const root = createRoot(el);
  act(() => root.render(node));
  return { el, unmount: () => act(() => root.unmount()) };
}

it('shows a recovery screen instead of a blank page when rendering crashes', () => {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const { el, unmount } = mount(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );
  expect(el.textContent).toContain('Something went wrong');
  expect(el.querySelector('button')?.textContent).toBe('Reload the page');
  unmount();
});

it('renders its children untouched when nothing fails', () => {
  const { el, unmount } = mount(
    <ErrorBoundary>
      <p>fine</p>
    </ErrorBoundary>,
  );
  expect(el.textContent).toBe('fine');
  unmount();
});
