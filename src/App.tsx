import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Shell } from './components/Shell';
import { Loading } from './components/States';
import { DetailPage } from './pages/DetailPage';
import { ListPage } from './pages/ListPage';
import { LoginPage } from './pages/LoginPage';

function RequireAuth() {
  const { status } = useAuth();
  const { pathname, search } = useLocation();
  if (status === 'loading') return <Loading label="Checking your session…" />;
  // Remember where they were so sign-in (or an expired session) returns them there.
  if (status === 'anon')
    return <Navigate to="/login" replace state={{ from: pathname + search }} />;
  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<Shell />}>
          <Route index element={<ListPage />} />
          <Route path="items/:id" element={<DetailPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
