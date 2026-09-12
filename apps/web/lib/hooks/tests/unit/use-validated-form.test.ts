// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useValidatedForm } from '../../use-validated-form';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function attachRequiredInputForm(formRef: React.RefObject<HTMLFormElement | null>) {
  const form = document.createElement('form');
  const input = document.createElement('input');
  input.name = 'email';
  input.required = true;
  form.appendChild(input);
  document.body.appendChild(form);
  (formRef as { current: HTMLFormElement }).current = form;
  return { form, input };
}

describe('useValidatedForm', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('reflects the form as invalid once mounted with an unfilled required field', () => {
    const { result } = renderHook(() => useValidatedForm());
    act(() => {
      attachRequiredInputForm(result.current.formRef);
      result.current.refreshValidity();
    });

    expect(result.current.formValid).toBe(false);
  });

  it('becomes valid once the required field is filled and refreshed', () => {
    const { result } = renderHook(() => useValidatedForm());
    const { input } = attachRequiredInputForm(result.current.formRef);

    act(() => {
      input.value = 'a@b.com';
      result.current.refreshValidity();
    });

    expect(result.current.formValid).toBe(true);
  });

  it('blocks submission and surfaces a client field error for an invalid field', () => {
    const { result } = renderHook(() => useValidatedForm());
    attachRequiredInputForm(result.current.formRef);

    const preventDefault = () => {};
    act(() => {
      result.current.handleSubmit({ preventDefault } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.hasClientErrors).toBe(true);
    expect(result.current.fieldError('email')).toBeTruthy();
  });

  it('does not block submission once the field is valid', () => {
    const { result } = renderHook(() => useValidatedForm());
    const { input } = attachRequiredInputForm(result.current.formRef);
    input.value = 'a@b.com';

    act(() => {
      result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.hasClientErrors).toBe(false);
  });

  it("prefers a server error over a client one for the same field, but falls back to the client one when there's no server error", () => {
    const { result } = renderHook(() => useValidatedForm({ email: 'Email already in use.' }));
    attachRequiredInputForm(result.current.formRef);

    act(() => {
      result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.fieldError('email')).toBe('Email already in use.');
    expect(result.current.fieldError('somethingElse')).toBeUndefined();
  });

  it('keeps client-error highlights live as the user fixes fields after a failed submit attempt', () => {
    const { result } = renderHook(() => useValidatedForm());
    const { input } = attachRequiredInputForm(result.current.formRef);

    act(() => {
      result.current.handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent<HTMLFormElement>);
    });
    expect(result.current.fieldError('email')).toBeTruthy();

    act(() => {
      input.value = 'a@b.com';
      result.current.refreshValidity();
    });

    expect(result.current.fieldError('email')).toBeUndefined();
  });
});
