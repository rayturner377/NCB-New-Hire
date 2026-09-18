# Activity navigation

Branch: `feat/activity-destination-links`
Previous onboarding work committed separately as `e93ef63`.

## Success criteria

- [x] Payment confirmed, billing updated and reviewed/paid transitions open Billing & status.
- [x] Doctor-submitted transitions open Doctor assessment; patient-completed transitions open Patient form.
- [x] Attachment activity opens Documents; other lifecycle transitions open History.
- [x] Case creation and reassignment open Overview.
- [x] Dashboard and full audit log share the same case-event destination resolver.
- [x] The case workspace reads `?tab=`, updates it on tab selection and handles invalid/hidden tabs.
- [x] Available audit targets have visible, native hyperlinks with descriptive accessible names.
- [x] Missing records remain readable without dead detail links. Dashboard entries for deleted users
  lead to the matching audit-event filter instead of an unrelated role list.
- [x] Targeted tests: 57 passed, covering services, rendered audit anchors and tab URL behavior.
- [ ] Browser walkthrough on the updated development application using synthetic data.

## Manual verification

Use `npm run dev`, not a production server. In an admin or HR reviewer session:

1. Open a payment event from Recent updates; confirm Billing & status is selected.
2. Open the same event through View full audit log; confirm the destination is identical.
3. Use keyboard Tab/Enter on the audit activity link; verify open-in-new-tab also works.
4. Switch to Documents, refresh, then use browser Back; confirm the URL and active tab agree.
5. Check doctor assessment, patient completion, attachment and ordinary status events.
6. Open an invalid `?tab=` value; expect Overview. A clinician's `?tab=history` must also
   fall back, without exposing history that the server did not render.

These changes do not grant access to destinations or change case/billing records. Existing
server authorization remains in place. Historical events without a resolvable target remain
plain text; not every audit entry represents a navigable application record.

The automated URL tests use mocked Next navigation; native browser Back, refresh and
new-tab behavior still require the manual walkthrough above.
