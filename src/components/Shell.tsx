import { useEffect, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Logo } from './Logo';
import { OfflineBanner } from './OfflineBanner';

export function Shell() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const main = useRef<HTMLElement>(null);

  // Move focus to the content when the route changes, so keyboard and screen-reader users land
  // in it. Not on first load: that would skip the "Skip to content" link and header.
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    main.current?.focus();
  }, [pathname]);

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="bar">
        <div className="bar-inner">
          <Link to="/" className="brand">
            <Logo />
            Stock console
          </Link>
          {user && (
            <span className="user">
              <span className="avatar" aria-hidden="true">
                {user.firstName.charAt(0)}
              </span>
              <span className="user-name">{user.firstName}</span>
            </span>
          )}
          <button type="button" onClick={logout}>
            Sign out
          </button>
        </div>
      </header>
      <OfflineBanner />
      <main id="main" ref={main} tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
