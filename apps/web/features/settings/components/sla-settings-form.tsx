'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Plus, Trash2 } from 'lucide-react';
import { updateSlaSettingsAction } from '../actions/update-settings';
import type { SlaDefinition } from '../types';
import { SLA_EVENT_POINTS, isValidEventOrder, type SlaEventKey } from '../sla-events';
import { Alert } from '../../../components/ui/alert';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';

export interface SlaSettingsFormProps {
  definitions: SlaDefinition[];
}

const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50';

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return base || 'policy';
}

function uniqueKey(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let suffix = 2;
  while (existing.has(`${base}_${suffix}`)) suffix += 1;
  return `${base}_${suffix}`;
}

function formatDuration(hours: number): string {
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} day${days === 1 ? '' : 's'}`;
  }
  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function emptyDefinition(existingKeys: Set<string>): SlaDefinition {
  return {
    key: uniqueKey('new_policy', existingKeys),
    name: '',
    description: '',
    startEvent: 'case_created',
    endEvent: 'doctor_submitted',
    targetHours: 48,
    warningPercent: 80,
    enabled: true
  };
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? 'Saving…' : 'Save changes'}
    </Button>
  );
}

/** One SLA policy — start/end milestone, target duration, warning threshold, on/off — as its own editable card. Referenced by `index` within the parent's array rather than by key, since a brand-new unsaved row's key can itself be edited (see slugify/uniqueKey above) before the admin ever hits Save. */
function SlaDefinitionCard({
  definition,
  onChange,
  onRemove
}: {
  definition: SlaDefinition;
  onChange: (next: SlaDefinition) => void;
  onRemove: () => void;
}) {
  const orderInvalid = !isValidEventOrder(definition.startEvent, definition.endEvent);
  const durationUnit = definition.targetHours % 24 === 0 && definition.targetHours >= 24 ? 'days' : 'hours';
  const durationValue = durationUnit === 'days' ? definition.targetHours / 24 : definition.targetHours;

  function setDurationValue(value: number, unit: 'hours' | 'days') {
    const hours = unit === 'days' ? value * 24 : value;
    onChange({ ...definition, targetHours: Math.max(1, Math.round(hours)) });
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label>Policy name</Label>
          <Input
            value={definition.name}
            onChange={(event) => onChange({ ...definition, name: event.target.value })}
            placeholder="e.g. Doctor submission to HR review"
            maxLength={200}
            required
          />
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Checkbox
            id={`enabled.${definition.key}`}
            checked={definition.enabled}
            onCheckedChange={(checked) => onChange({ ...definition, enabled: checked === true })}
          />
          <Label htmlFor={`enabled.${definition.key}`} className="cursor-pointer font-normal">
            Active
          </Label>
          <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Delete policy">
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Description</Label>
        <textarea
          value={definition.description ?? ''}
          onChange={(event) => onChange({ ...definition, description: event.target.value })}
          rows={2}
          maxLength={500}
          className={TEXTAREA_CLASS}
          placeholder="What this policy measures and why it matters"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Start milestone</Label>
          <Select value={definition.startEvent} onValueChange={(value) => onChange({ ...definition, startEvent: value as SlaEventKey })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLA_EVENT_POINTS.map((point) => (
                <SelectItem key={point.key} value={point.key}>
                  {point.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>End milestone</Label>
          <Select value={definition.endEvent} onValueChange={(value) => onChange({ ...definition, endEvent: value as SlaEventKey })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SLA_EVENT_POINTS.map((point) => (
                <SelectItem key={point.key} value={point.key}>
                  {point.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {orderInvalid ? (
        <p className="text-xs text-destructive">The end milestone can never follow the start milestone — pick a later one.</p>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Target duration</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              min={1}
              value={durationValue}
              onChange={(event) => setDurationValue(Number(event.target.value) || 1, durationUnit)}
              className="w-24"
            />
            <Select value={durationUnit} onValueChange={(unit) => setDurationValue(durationValue, unit as 'hours' | 'days')}>
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hours">Hours</SelectItem>
                <SelectItem value="days">Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Warn at (% of target elapsed)</Label>
          <Input
            type="number"
            min={1}
            max={99}
            value={definition.warningPercent}
            onChange={(event) => onChange({ ...definition, warningPercent: Math.min(99, Math.max(1, Number(event.target.value) || 1)) })}
            className="w-24"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Target: {formatDuration(definition.targetHours)} · flags &ldquo;at risk&rdquo; after {formatDuration(Math.round((definition.targetHours * definition.warningPercent) / 100))}
      </p>
    </div>
  );
}

/**
 * A full SLA manager rather than a fixed two-row form: an admin can define as
 * many turnaround-time policies as needed, each measuring between any two of
 * the case milestones in sla-events.ts. The list itself lives in local state
 * (add/edit/remove all happen client-side); the whole array is serialized
 * into one hidden field on submit (see update-settings.ts's
 * updateSlaSettingsAction) rather than posting one server action per row,
 * since add/remove change the row count itself.
 */
export function SlaSettingsForm({ definitions }: SlaSettingsFormProps) {
  const [rows, setRows] = useState<SlaDefinition[]>(definitions);
  const [state, formAction] = useActionState(updateSlaSettingsAction, null);

  const definitionsJson = useMemo(() => JSON.stringify(rows), [rows]);
  const hasInvalidOrder = rows.some((row) => !isValidEventOrder(row.startEvent, row.endEvent));
  const hasEmptyName = rows.some((row) => !row.name.trim());

  function updateRow(index: number, next: SlaDefinition) {
    setRows((current) => {
      // A brand-new row's key is still the auto-generated placeholder — derive a real one from
      // its name as the admin types, so it doesn't get saved as "new_policy_2". Once a row has
      // been given a real name-derived key, it stays stable even if the name changes again (see
      // SlaDefinition's own key doc comment) — only still-placeholder keys get re-derived here.
      const isPlaceholderKey = /^new_policy(_\d+)?$/.test(current[index]?.key ?? '');
      if (isPlaceholderKey && next.name.trim()) {
        const otherKeys = new Set(current.filter((_, rowIndex) => rowIndex !== index).map((row) => row.key));
        next = { ...next, key: uniqueKey(slugify(next.name), otherKeys) };
      }
      return current.map((row, rowIndex) => (rowIndex === index ? next : row));
    });
  }

  function removeRow(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function addRow() {
    setRows((current) => [...current, emptyDefinition(new Set(current.map((row) => row.key)))]);
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Define how long each stage of a case is allowed to take — HR review turnaround, time to pay the doctor, and the full
        assignment-to-payment cycle come pre-configured below, and you can add more or turn any of them off.
      </p>

      <div className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <SlaDefinitionCard
            key={index}
            definition={row}
            onChange={(next) => updateRow(index, next)}
            onRemove={() => removeRow(index)}
          />
        ))}
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">No SLA policies defined yet.</p> : null}
      </div>

      <Button type="button" variant="outline" size="sm" className="w-fit" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" /> Add SLA policy
      </Button>

      <input type="hidden" name="definitionsJson" value={definitionsJson} />

      {hasInvalidOrder ? <Alert tone="error">Fix the highlighted policy — an end milestone must happen after its start milestone.</Alert> : null}
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {state?.ok ? <Alert tone="success">Saved.</Alert> : null}

      <div className="flex justify-end">
        <SaveButton />
      </div>
      {/* Client-side guard only — the server action re-validates independently (update-settings.ts) since this disabled attribute can't be trusted. */}
      {hasInvalidOrder || hasEmptyName ? (
        <p className="text-right text-xs text-muted-foreground">Every policy needs a name and a valid milestone order before saving.</p>
      ) : null}
    </form>
  );
}
