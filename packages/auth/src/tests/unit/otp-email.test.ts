import { beforeEach, describe, expect, it, vi } from 'vitest';
import { sendOtpEmail, setOtpEmailSender } from '../../otp-email.js';

describe('otp-email', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Runs first, deliberately, before any test in this file ever calls setOtpEmailSender — the
  // module-level sender is otherwise unrecoverably set once, with no public API to unset it again.
  it('logs instead of throwing when no sender has been registered yet', async () => {
    await expect(sendOtpEmail({ id: 'user_1', email: 'doctor@ncb.local' }, '482913')).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalled();
  });

  it('calls whatever sender was registered, with the recipient and code', async () => {
    const sender = vi.fn().mockResolvedValue(undefined);
    setOtpEmailSender(sender);

    await sendOtpEmail({ id: 'user_1', email: 'doctor@ncb.local', name: 'Demo Doctor' }, '482913');

    expect(sender).toHaveBeenCalledWith({ id: 'user_1', email: 'doctor@ncb.local', name: 'Demo Doctor' }, '482913');
  });
});
