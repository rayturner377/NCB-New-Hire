import type { MedicalOffice, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NewMedicalOfficeInput {
  id: string;
  name: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  defaultMedicalFee?: number;
}

export interface MedicalOfficePatch {
  name?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  phone?: string;
  email?: string;
  defaultMedicalFee?: number;
}

/**
 * No decryption here — unlike candidates/cases/submissions, a medical
 * office's name/address/phone/email/fee aren't sensitive clinical data, so
 * they're plain columns rather than an encrypted payload. Address is split
 * into the same 5 parts (line1/line2/city/state/country) the candidate
 * profile and patient case form already use, for the shared AddressFields
 * component (see medical-office-form.tsx) — not stored as one free-text
 * string.
 */
export function createMedicalOfficesRepository(db: PrismaClient) {
  return {
    listActive(): Promise<MedicalOffice[]> {
      return db.medicalOffice.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } });
    },

    /** Every non-deleted facility, active or not — the admin-facing management table (medical-offices-table.tsx), which needs to keep showing a deactivated office so it can still be reactivated or deleted; listActive() alone would make it disappear the moment it's turned off. */
    listAll(): Promise<MedicalOffice[]> {
      return db.medicalOffice.findMany({ where: { deletedAt: null }, orderBy: { name: 'asc' } });
    },

    findById(id: string): Promise<MedicalOffice | null> {
      return db.medicalOffice.findFirst({ where: { id, deletedAt: null } });
    },

    setActive(id: string, active: boolean): Promise<MedicalOffice> {
      return db.medicalOffice.update({ where: { id }, data: { active } });
    },

    /** Soft delete — sets `deletedAt` rather than removing the row, so a case still referencing this office (assignedCases) keeps a valid foreign key and its own history stays intact. */
    softDelete(id: string): Promise<MedicalOffice> {
      return db.medicalOffice.update({ where: { id }, data: { deletedAt: new Date(), active: false } });
    },

    create(input: NewMedicalOfficeInput): Promise<MedicalOffice> {
      return db.medicalOffice.create({
        data: {
          id: input.id,
          name: input.name,
          addressLine1: input.addressLine1 || undefined,
          addressLine2: input.addressLine2 || undefined,
          city: input.city || undefined,
          state: input.state || undefined,
          country: input.country || undefined,
          phone: input.phone || undefined,
          email: input.email || undefined,
          defaultMedicalFee: input.defaultMedicalFee ?? 0
        }
      });
    },

    update(id: string, patch: MedicalOfficePatch): Promise<MedicalOffice> {
      return db.medicalOffice.update({
        where: { id },
        data: {
          name: patch.name,
          addressLine1: patch.addressLine1 ?? undefined,
          addressLine2: patch.addressLine2 ?? undefined,
          city: patch.city ?? undefined,
          state: patch.state ?? undefined,
          country: patch.country ?? undefined,
          phone: patch.phone ?? undefined,
          email: patch.email ?? undefined,
          defaultMedicalFee: patch.defaultMedicalFee
        }
      });
    }
  };
}

export const medicalOfficesRepository = createMedicalOfficesRepository(prisma);
