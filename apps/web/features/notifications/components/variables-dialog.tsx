'use client';

import { useState } from 'react';
import { Check, ListTree } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';

export interface VariableInfo {
  name: string;
  description: string;
}

export interface VariablesDialogProps {
  variables: VariableInfo[];
}

/**
 * Replaces the old flat "{{portalName}} {{organizationName}} ..." text line
 * with a proper searchable reference — the full variable list (common tokens
 * like portalName/logoUrl plus whatever this specific template adds) with
 * descriptions, filterable by name or description. Clicking a row copies its
 * `{{token}}` to the clipboard rather than inserting at the cursor directly —
 * simpler and works identically regardless of which editor mode (WYSIWYG or
 * raw HTML) is active, since both are just "paste it where you want it."
 */
export function VariablesDialog({ variables }: VariablesDialogProps) {
  const [query, setQuery] = useState('');
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? variables.filter((variable) => variable.name.toLowerCase().includes(needle) || variable.description.toLowerCase().includes(needle))
    : variables;

  async function handleCopy(name: string) {
    const token = `{{${name}}}`;
    try {
      await navigator.clipboard.writeText(token);
      setCopiedName(name);
      setTimeout(() => setCopiedName((current) => (current === name ? null : current)), 1500);
    } catch {
      // Clipboard API unavailable (e.g. an insecure context) — the token is still shown on screen to copy by hand.
    }
  }

  return (
    <Dialog onOpenChange={() => setQuery('')}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ListTree className="mr-1.5 h-3.5 w-3.5" /> View variables
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Available variables</DialogTitle>
          <DialogDescription>Click one to copy it, then paste it into the editor wherever you want it to appear.</DialogDescription>
        </DialogHeader>
        <Input autoFocus placeholder="Search variables…" value={query} onChange={(event) => setQuery(event.target.value)} />
        <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No variables match &ldquo;{query}&rdquo;.</p>
          ) : (
            filtered.map((variable) => (
              <button
                key={variable.name}
                type="button"
                onClick={() => handleCopy(variable.name)}
                className="flex flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                  {`{{${variable.name}}}`}
                  {copiedName === variable.name ? <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> : null}
                </span>
                <span className="text-xs text-muted-foreground">{variable.description}</span>
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
