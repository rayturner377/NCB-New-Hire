import { randomUUID } from 'node:crypto';
import { auditRepository, medicalOfficesRepository, type MedicalOffice } from '@ncb/database';
import { formatAddress } from '../../../lib/address';
import type { CreateMedicalOfficeSchemaInput, UpdateMedicalOfficeSchemaInput } from '../schemas/medical-office';

export interface MedicalOfficeOption {
  id: string;
  name: string;
  /** The 5 stored parts joined into one display line (see lib/address.ts's formatAddress) — this projection is read-only, so callers never need the parts separately. */
  address: string | null;
}

/** id/name/address only, plain strings — the shape doctor-profile-fields.tsx's facility picker and its "which office" callers actually need, and (unlike the raw MedicalOfficesRepository row) safe to pass to a Client Component: MedicalOffice.defaultMedicalFee is a Prisma Decimal, which Next.js refuses to serialize across the server/client boundary. Server components that render the full record themselves (e.g. medical-office-detail-container.tsx, MedicalOfficesTable) should keep using listActiveMedicalOffices()/getMedicalOfficeById() directly instead of this. */
export function toOfficeOption(office: MedicalOffice): MedicalOfficeOption {
  const address = formatAddress({
    addressLine1: office.addressLine1 ?? '',
    addressLine2: office.addressLine2 ?? '',
    city: office.city ?? '',
    state: office.state ?? '',
    country: office.country ?? ''
  });
  return { id: office.id, name: office.name, address: address || null };
}

export async function listActiveMedicalOffices() {
  return medicalOfficesRepository.listActive();
}

/** Every non-deleted facility, active or not — see listAll()'s own comment on why the admin-facing table needs this instead of listActiveMedicalOffices(). */
export async function listAllMedicalOffices() {
  return medicalOfficesRepository.listAll();
}

/** listActiveMedicalOffices(), projected down to MedicalOfficeOption — for any container that hands the list to a Client Component (UsersTable's edit dialog, UserForm's facility picker). */
export async function listActiveMedicalOfficeOptions(): Promise<MedicalOfficeOption[]> {
  const offices = await listActiveMedicalOffices();
  return offices.map(toOfficeOption);
}

export async function getMedicalOfficeById(id: string) {
  return medicalOfficesRepository.findById(id);
}

export async function createMedicalOffice(input: CreateMedicalOfficeSchemaInput, actorId?: string) {
  const id = randomUUID();
  const created = await medicalOfficesRepository.create({ id, ...input });

  await auditRepository.append({
    eventType: 'medical_office_created',
    actorUserId: actorId,
    entityType: 'medical_office',
    entityId: id,
    details: { name: input.name }
  });

  return created;
}

export async function updateMedicalOffice(id: string, patch: UpdateMedicalOfficeSchemaInput, actorId?: string): Promise<MedicalOffice> {
  const updated = await medicalOfficesRepository.update(id, patch);

  await auditRepository.append({
    eventType: 'medical_office_updated',
    actorUserId: actorId,
    entityType: 'medical_office',
    entityId: id,
    details: { name: updated.name }
  });

  return updated;
}

export async function setMedicalOfficeActive(id: string, active: boolean, actorId?: string): Promise<MedicalOffice> {
  const updated = await medicalOfficesRepository.setActive(id, active);

  await auditRepository.append({
    eventType: active ? 'medical_office_activated' : 'medical_office_deactivated',
    actorUserId: actorId,
    entityType: 'medical_office',
    entityId: id,
    details: { name: updated.name }
  });

  return updated;
}

/** Soft delete — see medicalOfficesRepository.softDelete. Captures the name in the audit event's own details since a deleted office drops out of listAll() (and so out of any later "who is this" lookup by id). */
export async function deleteMedicalOffice(id: string, actorId?: string): Promise<void> {
  const deleted = await medicalOfficesRepository.softDelete(id);

  await auditRepository.append({
    eventType: 'medical_office_deleted',
    actorUserId: actorId,
    entityType: 'medical_office',
    entityId: id,
    details: { name: deleted.name }
  });
}
