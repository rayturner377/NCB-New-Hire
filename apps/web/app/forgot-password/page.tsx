import { redirect } from 'next/navigation';

/**
 * Retired as its own page — code redemption now happens inline on /login's
 * "Forgot password?" step (see login-form.tsx). This route stays only so
 * existing emailed links (resetUrl in already-sent notifications) and
 * bookmarks still land somewhere real instead of 404ing.
 */
export default function ForgotPasswordPage() {
  redirect('/login');
}
