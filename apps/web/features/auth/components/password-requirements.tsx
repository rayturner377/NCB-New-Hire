import { Check, Circle } from 'lucide-react';
import { Progress } from '../../../components/ui/progress';
import { cn } from '../../../lib/utils';
import { passwordRequirements, type PasswordPolicy } from '../../settings/password-policy';

export function PasswordRequirements({ password, policy, id }: { password: string; policy: PasswordPolicy; id: string }) {
  const requirements = passwordRequirements(password, policy);
  const met = requirements.filter((requirement) => requirement.met).length;
  const complete = met === requirements.length;

  return (
    <div id={id} className="mt-1 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="font-medium text-muted-foreground">Password requirements</span>
        <span role="status" aria-live="polite" aria-atomic="true" className={cn('text-muted-foreground', complete && 'text-emerald-700 dark:text-emerald-400')}>
          {complete ? 'All requirements met' : `${met} of ${requirements.length} met`}
        </span>
      </div>
      <Progress value={(met / requirements.length) * 100} aria-label="Password requirements met" className="h-1" />
      <ul className="grid gap-x-4 gap-y-1.5 text-xs sm:grid-cols-2">
        {requirements.map((requirement) => {
          const Icon = requirement.met ? Check : Circle;
          return (
            <li key={requirement.id} className={cn('flex items-center gap-1.5 text-muted-foreground', requirement.met && 'text-emerald-700 dark:text-emerald-400')}>
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="sr-only">{requirement.met ? 'Met: ' : 'Not yet met: '}</span>
              {requirement.label}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
