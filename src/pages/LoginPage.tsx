import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/http';
import { useAuth } from '../auth/AuthContext';
import { Logo } from '../components/Logo';

export function LoginPage() {
  const { status, login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'authed') return <Navigate to={from} replace />;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError('');
    try {
      await login(String(f.get('username')), String(f.get('password')));
      navigate(from, { replace: true });
    } catch (err) {
      const rejected = err instanceof ApiError && err.status >= 400 && err.status < 500;
      setError(
        rejected
          ? 'Sign-in failed. Check your username and password, then try again.'
          : 'Could not reach the server. Check your connection and try again.',
      );
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="card login-card">
        <Logo />
        <h1>Sign in to Stock console</h1>
        <p className="muted">Demo account details are filled in for you.</p>
        <form onSubmit={onSubmit}>
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              required
              defaultValue="emilys"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              defaultValue="emilyspass"
            />
          </label>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <button type="submit" className="primary" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  );
}
