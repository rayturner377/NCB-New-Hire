import { redirect } from 'next/navigation';
import { getSession } from '../../lib/session';
import { LoginForm } from '../../features/auth/components/login-form';

export default async function LoginPage() {
  const session = await getSession();
  if (session) {
    redirect('/');
  }

  return (
    <main className="login-page">
      <h1>National Commercial Bank Jamaica Medical Platform</h1>
      <LoginForm />
    </main>
  );
}
