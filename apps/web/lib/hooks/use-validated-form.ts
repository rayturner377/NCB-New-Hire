'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';

/** Walks every named field and collects the browser's own validation message for whichever ones are currently invalid. */
function collectInvalidFields(form: HTMLFormElement): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const element of Array.from(form.elements)) {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLSelectElement || element instanceof HTMLTextAreaElement)) continue;
    if (!element.name || errors[element.name]) continue;
    if (!element.checkValidity()) {
      errors[element.name] = element.validationMessage || 'This field is required.';
    }
  }
  return errors;
}

/**
 * Shared plumbing behind every "Create X" form (candidates, users, ...):
 * tracks whether the form currently satisfies native HTML validation
 * (`formValid`, for gating the submit button's appearance), and — since a
 * disabled button gives zero feedback when someone tries to submit anyway —
 * surfaces which fields are missing on a blocked submit attempt the same way
 * a server-side field error would (`fieldError`), plus calls the browser's
 * own `reportValidity()` to focus/highlight the first one.
 *
 * `onChange`/`onSubmit` from the returned object go straight on the
 * `<form>`; `serverErrors` are merged in so a server-rejected field and a
 * client-caught missing field render identically.
 */
export function useValidatedForm(serverErrors?: Record<string, string>) {
  const formRef = useRef<HTMLFormElement>(null);
  const [formValid, setFormValid] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  function refreshValidity() {
    const form = formRef.current;
    if (!form) return;
    setFormValid(form.checkValidity());
    // Once the user has tried to submit once, keep the highlights live as they fix things, instead of only clearing on the next attempt.
    setClientErrors((prev) => (Object.keys(prev).length > 0 ? collectInvalidFields(form) : prev));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = formRef.current;
    if (!form) return;
    if (!form.checkValidity()) {
      event.preventDefault();
      setClientErrors(collectInvalidFields(form));
      form.reportValidity();
    }
  }

  useEffect(() => {
    refreshValidity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function fieldError(name: string): string | undefined {
    return serverErrors?.[name] ?? clientErrors[name];
  }

  return {
    formRef,
    formValid,
    refreshValidity,
    handleSubmit,
    fieldError,
    hasClientErrors: Object.keys(clientErrors).length > 0
  };
}
