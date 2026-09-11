'use client';

import { CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';

export interface ActionSuccessDialogProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

/**
 * A shared "this step is actually done" modal — used wherever a workflow
 * step (assigning a medical, a patient submitting to their doctor, a doctor
 * submitting their assessment) needs an explicit, hard-to-miss confirmation
 * rather than an inline banner that can scroll out of view. Only meant to be
 * opened once the server has confirmed success — never optimistically.
 */
export function ActionSuccessDialog({ open, title, description, confirmLabel = 'Continue', onConfirm }: ActionSuccessDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onConfirm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/40">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter className="sm:justify-center">
          <Button type="button" onClick={onConfirm}>{confirmLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
