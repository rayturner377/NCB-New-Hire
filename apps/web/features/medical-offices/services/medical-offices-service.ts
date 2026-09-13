import { randomUUID } from 'node:crypto';
import { auditRepository, medicalOfficesRepository } from '@ncb/database';
import type { CreateMedicalOfficeSchemaInput } from '../schemas/medical-office';

export async function listActiveMedicalOffices() {
  return medicalOfficesRepository.listActive();
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
