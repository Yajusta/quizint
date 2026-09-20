import { lazy, Suspense, type ComponentType } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';

import { ComingSoonPage } from '../pages/ComingSoon.tsx';
import { JoinCodePage } from '../pages/JoinCodePage.tsx';
import { ParticipantSessionPage } from '../pages/ParticipantSessionPage.tsx';

/** Route-level code split on a named export (the `import()` stays literal so Vite still splits it). */
function lazyNamed<K extends string, M extends Record<K, ComponentType>>(load: () => Promise<M>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const LoginPage = lazyNamed(() => import('../pages/admin/LoginPage.tsx'), 'LoginPage');
const DashboardPage = lazyNamed(() => import('../pages/admin/DashboardPage.tsx'), 'DashboardPage');
const QuizEditorPage = lazyNamed(() => import('../pages/admin/QuizEditorPage.tsx'), 'QuizEditorPage');
const ArchivedQuizzesPage = lazyNamed(
  () => import('../pages/admin/ArchivedQuizzesPage.tsx'),
  'ArchivedQuizzesPage',
);
const AdminsPage = lazyNamed(() => import('../pages/admin/AdminsPage.tsx'), 'AdminsPage');
const SessionsPage = lazyNamed(() => import('../pages/admin/SessionsPage.tsx'), 'SessionsPage');
const SessionDetailPage = lazyNamed(
  () => import('../pages/admin/SessionDetailPage.tsx'),
  'SessionDetailPage',
);
const PresenterSessionPage = lazyNamed(
  () => import('../pages/presenter/PresenterSessionPage.tsx'),
  'PresenterSessionPage',
);

/**
 * Shown while a route chunk — and, on the very first paint, the i18next dictionaries — load. No
 * text: no language is resolved yet at that point, and a wrong-language flash is worse than none.
 */
function Fallback() {
  return (
    <div
      aria-busy="true"
      style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', color: 'var(--text-secondary)' }}
    />
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route path="/" element={<JoinCodePage />} />
          <Route path="/j/:code" element={<ParticipantSessionPage />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/admin" element={<DashboardPage />} />
          <Route path="/admin/quizzes/new" element={<QuizEditorPage />} />
          <Route path="/admin/quizzes/archived" element={<ArchivedQuizzesPage />} />
          <Route path="/admin/quizzes/:id" element={<QuizEditorPage />} />
          <Route path="/admin/sessions" element={<SessionsPage />} />
          <Route path="/admin/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/admin/admins" element={<AdminsPage />} />
          <Route path="/present/:sessionId" element={<PresenterSessionPage />} />
          <Route path="*" element={<ComingSoonPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
