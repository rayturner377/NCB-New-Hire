import Link from 'next/link';
import { ArrowLeft, Beaker, Briefcase, CheckCircle2, Mail, UserRound, XCircle } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { SectionCard } from '../../../components/dashboard/section-card';
import type { MessageCategory, MessageDetail as MessageDetailData } from '../services/messages-service';
import { ResendMessageButton } from './resend-message-button';

export interface MessageDetailProps {
  message: MessageDetailData;
  /** Gated on NOTIFICATIONS_MANAGE specifically (see message-detail-container.tsx) — a view-only auditor (NOTIFICATIONS_VIEW) can open this page but shouldn't see a "Resend" button that would just fail server-side. */
  canResend: boolean;
}

const CATEGORY_ICON: Record<MessageCategory, typeof Mail> = {
  case: Briefcase,
  account: UserRound,
  test: Beaker,
  other: Mail
};

export function MessageDetail({ message, canResend }: MessageDetailProps) {
  const CategoryIcon = CATEGORY_ICON[message.category];

  return (
    <div className="flex flex-col gap-4">
      <Link href="/messages" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Message Centre
      </Link>

      <SectionCard
        title={message.subject}
        description={new Date(message.createdAt).toLocaleString()}
        action={message.status === 'failed' && canResend ? <ResendMessageButton id={message.id} /> : null}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {message.status === 'failed' ? (
            <Badge variant="destructive" className="flex items-center gap-1">
              <XCircle className="h-3 w-3" /> Failed
            </Badge>
          ) : (
            <Badge variant="secondary" className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Sent
            </Badge>
          )}
          <Badge variant="outline" className="flex items-center gap-1">
            <CategoryIcon className="h-3 w-3" /> {message.templateLabel}
          </Badge>
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <div className="flex flex-col">
            <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">To</dt>
            <dd className="text-sm">{message.to}</dd>
          </div>
          {message.cc ? (
            <div className="flex flex-col">
              <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">CC</dt>
              <dd className="text-sm">{message.cc}</dd>
            </div>
          ) : null}
          {message.bcc ? (
            <div className="flex flex-col">
              <dt className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">BCC</dt>
              <dd className="text-sm">{message.bcc}</dd>
            </div>
          ) : null}
        </dl>

        {message.errorMessage ? (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {message.errorMessage}
          </p>
        ) : null}
      </SectionCard>

      <SectionCard title="Message content" description="Rendered exactly as it was sent">
        <iframe title="Email content" srcDoc={message.bodyHtml} sandbox="" className="h-[600px] w-full rounded-md border bg-white" />
      </SectionCard>
    </div>
  );
}
