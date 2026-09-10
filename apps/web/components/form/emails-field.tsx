'use client';

import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/button';
import { FormField } from '../ui/form-field';
import { Input } from '../ui/input';

export interface EmailsFieldProps {
  name: string;
  label?: string;
  defaultValues?: string[];
  disabled?: boolean;
  maxEmails?: number;
  /** Caps the field's width — default (max-w-sm) keeps a single email from stretching edge-to-edge in a wide layout; pass '' to go full width. */
  className?: string;
}

/**
 * One or more editable email addresses under the same field name
 * (FormData.getAll picks up every entry) — same add/remove pattern as
 * PhoneNumbersField, for a patient who wants to add a personal email
 * alongside the one HR has on file.
 */
export function EmailsField({ name, label = 'Email address', defaultValues, disabled = false, maxEmails = 3, className = 'max-w-sm' }: EmailsFieldProps) {
  const [emails, setEmails] = useState<string[]>(defaultValues?.length ? defaultValues : ['']);

  function updateEmail(index: number, value: string) {
    setEmails((prev) => prev.map((existing, i) => (i === index ? value : existing)));
  }

  function addEmail() {
    setEmails((prev) => (prev.length < maxEmails ? [...prev, ''] : prev));
  }

  function removeEmail(index: number) {
    setEmails((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <FormField label={label} name={name} className={className}>
      <div className="flex flex-col gap-2">
        {emails.map((value, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input
              id={index === 0 ? name : undefined}
              name={name}
              type="email"
              value={value}
              onChange={(event) => updateEmail(index, event.target.value)}
              placeholder="e.g. jane.doe@example.com"
              disabled={disabled}
            />
            {!disabled && emails.length > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={() => removeEmail(index)}
                aria-label="Remove this email"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        ))}
        {!disabled && emails.length < maxEmails ? (
          <Button type="button" variant="link" size="sm" className="h-auto w-fit p-0" onClick={addEmail}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add another email
          </Button>
        ) : null}
      </div>
    </FormField>
  );
}
