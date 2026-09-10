import { randomUUID } from 'node:crypto';
import { medicalOfficesRepository } from '@ncb/database';
import type { CreateMedicalOfficeSchemaInput } from '../schemas/medical-office';

export async function listActiveMedicalOffices() {
  return medicalOfficesRepository.listActive();
}

export async function getMedicalOfficeById(id: string) {
  return medicalOfficesRepository.findById(id);
}

export async function createMedicalOffice(input: CreateMedicalOfficeSchemaInput) {
  return medicalOfficesRepository.create({ id: randomUUID(), ...input });
}
