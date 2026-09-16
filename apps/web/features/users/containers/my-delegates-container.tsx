import { redirect } from 'next/navigation';
import { SectionCard } from '../../../components/dashboard/section-card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { getEffectivePermissions } from '../../../lib/effective-permissions';
import { PERMISSIONS, ROLES } from '../../../lib/permissions';
import { getSession } from '../../../lib/session';
import { DelegateActiveSwitch, DelegateBillingSwitch } from '../components/delegate-controls';
import { listDelegatesForClinician } from '../services/users-service';

const HEAD_CLASS = 'h-auto px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground';
const CELL_CLASS = 'px-3 py-2.5';

/**
 * A doctor's own "Delegates" tab — narrow self-service management of the
 * assistant account(s) linked to them, distinct from /delegates'
 * admin/reviewer-facing RoleUsersContainer (full CRUD across every
 * delegate in the system). A doctor can only activate/deactivate their own
 * delegate and toggle whether that delegate can see billing/payable-amount
 * figures — no create, no role change, no delete, no reassignment to a
 * different doctor, all of which stay admin/reviewer-only.
 */
export async function MyDelegatesContainer() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  if (session.user.role !== ROLES.DOCTOR) {
    redirect('/');
  }

  const delegates = await listDelegatesForClinician(session.user.id);
  const billingViewByDelegate = new Map<string, boolean>();
  for (const delegate of delegates) {
    const effective = await getEffectivePermissions(delegate);
    billingViewByDelegate.set(delegate.id, effective.includes(PERMISSIONS.MEDICAL_CASES_BILLING_VIEW));
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <SectionCard title="Delegates" description="The assistant account(s) acting on your behalf.">
        {delegates.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">No delegate is linked to your account yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className={HEAD_CLASS}>Name</TableHead>
                <TableHead className={HEAD_CLASS}>Email</TableHead>
                <TableHead className={HEAD_CLASS}>Status</TableHead>
                <TableHead className={HEAD_CLASS}>Can view billing</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {delegates.map((delegate) => {
                const canViewBilling = billingViewByDelegate.get(delegate.id) ?? false;
                return (
                  <TableRow key={delegate.id}>
                    <TableCell className={CELL_CLASS + ' text-xs font-semibold'}>{delegate.displayName}</TableCell>
                    <TableCell className={CELL_CLASS + ' text-xs text-muted-foreground'}>{delegate.email}</TableCell>
                    <TableCell className={CELL_CLASS}>
                      <DelegateActiveSwitch delegateId={delegate.id} active={delegate.active} />
                    </TableCell>
                    <TableCell className={CELL_CLASS}>
                      <DelegateBillingSwitch delegateId={delegate.id} canViewBilling={canViewBilling} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
