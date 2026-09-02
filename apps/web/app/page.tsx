import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '../lib/session';
import { logout } from '../features/auth/actions/logout';

/**
 * Placeholder landing page — the real per-role dashboards (doctor/reviewer/
 * admin) are the next feature slices (features/candidates, features/cases,
 * features/submissions per the plan's sequencing), not built yet.
 */
export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }

  return (
    <main className="dashboard-placeholder">
      <h1>Signed in as {session.user.displayName}</h1>
      <p>Role: {session.user.role}</p>
      <p>
        <Link href="/candidates">Candidates</Link> · <Link href="/cases">Cases</Link>
      </p>
      <form action={logout}>
        <button type="submit">Sign out</button>
      </form>
    </main>
  );
}
