import type { MedicalOffice, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface NewMedicalOfficeInput {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  defaultMedicalFee?: number;
}

/**
 * No decryption here — unlike candidates/cases/submissions, a medical
 * office's name/address/phone/email/fee aren't sensitive clinical data, so
 * they're plain columns rather than an encrypted payload.
 */
export function createMedicalOfficesRepository(db: PrismaClient) {
  return {
    listActive(): Promise<MedicalOffice[]> {
      return db.medicalOffice.findMany({ where: { active: true, deletedAt: null }, orderBy: { name: 'asc' } });
    },

    findById(id: string): Promise<MedicalOffice | null> {
      return db.medicalOffice.findFirst({ where: { id, deletedAt: null } });
    },

    create(input: NewMedicalOfficeInput): Promise<MedicalOffice> {
      return db.medicalOffice.create({
        data: {
          id: input.id,
          name: input.name,
          address: input.address || undefined,
          phone: input.phone || undefined,
          email: input.email || undefined,
          defaultMedicalFee: input.defaultMedicalFee ?? 0
        }
      });
    }
  };
}

export const medicalOfficesRepository = createMedicalOfficesRepository(prisma);
