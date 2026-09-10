'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useIdleTimer } from 'react-idle-timer';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../../components/ui/dialog';
import { logout } from '../actions/logout';
import { refreshSessionAction } from '../actions/refresh-session';

/** Matches the old app's 1-minute session-expiry warning window (server.js's sessionWarningMs). */
const PROMPT_BEFORE_IDLE_MS = 60_000;
/** Caps how often real activity actually reaches the server. */
const REFRESH_THROTTLE_MS = 60_000;

export interface SessionIdleManagerProps {
  /** The server's actual session length (SESSION_TIMEOUT_MINUTES), so the client-side countdown matches what the server will really enforce. */
  sessionTtlMs: number;
}

/**
 * Ports the old app's idle-detection + warning-modal + session-refresh flow
 * (public/app.js's startSessionTimers/showSessionWarning/
 * refreshSessionFromWarningActivity, ~L10490-10567) — mounted once in
 * AppShell so it runs for every authenticated page.
 *
 * How this avoids "bombarding the server" with resets, the way larger apps
 * handle idle/session timers:
 * - `throttle` limits `onAction` (fired on click/keydown/mousemove/scroll/
 *   touch) to at most once per REFRESH_THROTTLE_MS — a user typing
 *   continuously into the candidate form still only pings the server about
 *   once a minute, not once a keystroke. There's no value in refreshing more
 *   often than that; the point is "was there *some* activity recently," not
 *   an exact timestamp.
 * - `crossTab` + `leaderElection` elect one browser tab as the leader to
 *   actually own the timer and make the refresh calls; other open tabs of
 *   the app just follow along (via BroadcastChannel) instead of each
 *   independently polling the server and popping their own warning dialog.
 * - The warning dialog only appears in the last minute before expiry
 *   (`promptBeforeIdle`), and only an explicit "Stay signed in" click (or
 *   dismissing the dialog) calls `activate()` — incidental activity while
 *   the prompt is showing doesn't silently dismiss it, so the user has to
 *   affirmatively confirm they're still there, same as the old app's modal.
 */
export function SessionIdleManager({ sessionTtlMs }: SessionIdleManagerProps) {
  const router = useRouter();
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  /**
   * `logout()` (features/auth/actions/logout.ts) calls next/navigation's
   * `redirect()` itself, which works reliably when a Server Action is
   * invoked via a real `<form action={...}>` submission (see
   * components/layout/user-menu.tsx's "Sign out" menu item) — Next's client
   * runtime follows the redirect as part of that submission. Calling the
   * same action directly from a timer callback or a plain onClick (as both
   * call sites below do) isn't a form submission, so that automatic
   * redirect-follow isn't guaranteed to run: the server-side work (session
   * destroyed, audit event logged) still happens, but the browser can be
   * left showing the same page until something else (e.g. a manual refresh)
   * triggers AuthenticatedLayout's own `getSession()` check — which is
   * exactly the "doesn't redirect until I refresh" bug. Explicitly calling
   * `router.push()` after awaiting the action is what actually navigates
   * here, regardless of whether the action's own redirect took effect.
   */
  async function signOut(reason?: 'idle') {
    try {
      await logout(reason);
    } catch {
      // Expected — logout()'s own redirect() throws by design; the router.push below is what actually navigates in this non-form call path.
    } finally {
      router.push(reason === 'idle' ? '/login?reason=idle' : '/login');
    }
  }

  const { getRemainingTime, activate } = useIdleTimer({
    timeout: sessionTtlMs,
    promptBeforeIdle: Math.min(PROMPT_BEFORE_IDLE_MS, Math.max(sessionTtlMs - 5_000, 0)),
    throttle: REFRESH_THROTTLE_MS,
    crossTab: true,
    leaderElection: true,
    syncTimers: 1_000,
    onAction: () => {
      void refreshSessionAction();
    },
    onPrompt: () => {
      setShowWarning(true);
    },
    onIdle: () => {
      setShowWarning(false);
      void signOut('idle');
    }
  });

  useEffect(() => {
    if (!showWarning) return;
    setRemainingSeconds(Math.ceil(getRemainingTime() / 1000));
    const interval = setInterval(() => {
      setRemainingSeconds(Math.ceil(getRemainingTime() / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [showWarning, getRemainingTime]);

  async function staySignedIn() {
    setShowWarning(false);
    activate();
    await refreshSessionAction();
  }

  return (
    <Dialog
      open={showWarning}
      onOpenChange={(open) => {
        if (!open) void staySignedIn();
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Still there?</DialogTitle>
          <DialogDescription>
            You&apos;ve been inactive for a while. For your security, you&apos;ll be signed out in {Math.max(remainingSeconds, 0)}s
            unless you stay signed in.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => void signOut('idle')}>
            Sign out
          </Button>
          <Button onClick={() => void staySignedIn()}>Stay signed in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
