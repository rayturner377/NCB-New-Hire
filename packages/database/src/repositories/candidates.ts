import { decryptJson, encryptJson, type EncryptedRecord } from '@ncb/shared';
import type { PatientProfile, Prisma, PrismaClient } from '../generated/client/index.js';
import { prisma } from '../client.js';

export interface CandidateInput {
  id: string;
  fullName: string;
  email?: string;
  employeeId?: string;
  dateOfBirth?: Date;
  contactNumber?: string;
  createdBy?: string;
  linkedUserId?: string;
  /** Mirrored as a plain column (see migration 0027_candidate_status_position_columns) so the list can filter/sort in SQL — kept in sync with the same field inside `payload` on every write. */
  status?: string;
  /** Same reasoning as `status` above. */
  position?: string;
  /** Full candidate object; encrypted into profile_payload. */
  payload: unknown;
}

/** Matches billing-status.ts's isCancelledCase — kept in sync there, not re-derived (candidates.ts can't import from apps/web), same as cases.ts's own copy of this list. */
const CANCELLED_CASE_STATUSES = ['canceled_by_doctor', 'withdrawn'];

export interface CandidateSearchFilters {
  /** Matched against fullName, employeeId, or email — case-insensitive, substring. */
  query?: string;
  status?: string;
  position?: string;
  /** A candidate matches if ANY of their cases has this status. */
  caseStage?: string;
  /** Same billing classification as cases.ts's derivedPaymentStatus — a candidate matches if ANY of their cases falls into this billing bucket. */
  caseBilling?: 'paid' | 'unpaid' | 'not_payable' | '';
}

export interface CandidateWithPayload<T = unknown> extends PatientProfile {
  payload: T | null;
}

function decryptCandidate<T = unknown>(row: PatientProfile, masterKey: Buffer): CandidateWithPayload<T> {
  if (!row.profilePayload) return { ...row, payload: null };
  const record = JSON.parse(Buffer.from(row.profilePayload).toString('utf8')) as EncryptedRecord;
  return { ...row, payload: decryptJson<T>(masterKey, record) };
}

export function buildCandidateSearchWhere(filters: CandidateSearchFilters): Prisma.PatientProfileWhereInput {
  const and: Prisma.PatientProfileWhereInput[] = [{ deletedAt: null }];
  if (filters.query) {
    and.push({
      OR: [
        { fullName: { contains: filters.query, mode: 'insensitive' } },
        { employeeId: { contains: filters.query, mode: 'insensitive' } },
        { email: { contains: filters.query, mode: 'insensitive' } }
      ]
    });
  }
  if (filters.status) {
    and.push({ status: filters.status });
  }
  if (filters.position) {
    and.push({ position: filters.position });
  }
  if (filters.caseStage) {
    and.push({ cases: { some: { status: filters.caseStage } } });
  }
  if (filters.caseBilling === 'not_payable') {
    and.push({ cases: { some: { OR: [{ status: { in: CANCELLED_CASE_STATUSES } }, { paymentStatus: 'not_payable' }] } } });
  } else if (filters.caseBilling === 'paid') {
    and.push({ cases: { some: { status: { notIn: CANCELLED_CASE_STATUSES }, paymentStatus: 'paid' } } });
  } else if (filters.caseBilling === 'unpaid') {
    and.push({
      cases: {
        some: {
          status: { notIn: CANCELLED_CASE_STATUSES },
          OR: [{ paymentStatus: null }, { paymentStatus: { notIn: ['paid', 'not_payable'] } }]
        }
      }
    });
  } else if (filters.caseBilling) {
    and.push({ id: '__no_candidate_has_this_id__' });
  }
  return { AND: and };
}

export function createCandidatesRepository(db: PrismaClient) {
  return {
    async listAll<T = unknown>(masterKey: Buffer): Promise<CandidateWithPayload<T>[]> {
      const rows = await db.patientProfile.findMany({ where: { deletedAt: null } });
      return rows.map((row) => decryptCandidate<T>(row, masterKey));
    },

    async findById<T = unknown>(id: string, masterKey: Buffer): Promise<CandidateWithPayload<T> | null> {
      const row = await db.patientProfile.findFirst({ where: { id, deletedAt: null } });
      return row ? decryptCandidate<T>(row, masterKey) : null;
    },

    async listForUser<T = unknown>(linkedUserId: string, masterKey: Buffer): Promise<CandidateWithPayload<T>[]> {
      const rows = await db.patientProfile.findMany({ where: { linkedUserId, deletedAt: null } });
      return rows.map((row) => decryptCandidate<T>(row, masterKey));
    },

    /**
     * The paginated, filtered equivalent of listAll — query/status/position/caseStage/caseBilling
     * all resolve in SQL now (see migration 0027_candidate_status_position_columns and the `cases`
     * relation filters above), so the `where` clause narrows the result set before anything is
     * fetched, and only the returned page gets decrypted, not the whole table. Each row's case
     * count comes from Prisma's own `_count` aggregate rather than fetching every case just to
     * measure how many there are.
     */
    async search<T = unknown>(
      filters: CandidateSearchFilters,
      page: number,
      pageSize: number,
      masterKey: Buffer
    ): Promise<{ rows: (CandidateWithPayload<T> & { caseCount: number })[]; total: number }> {
      const where = buildCandidateSearchWhere(filters);
      const [rows, total] = await Promise.all([
        db.patientProfile.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: { _count: { select: { cases: true } } }
        }),
        db.patientProfile.count({ where })
      ]);
      return {
        rows: rows.map((row) => ({ ...decryptCandidate<T>(row, masterKey), caseCount: row._count.cases })),
        total
      };
    },

    /** Every distinct position on file, for the candidates list's position filter dropdown — no decryption needed, and no full-table fetch just to build a dropdown. */
    async listDistinctPositions(): Promise<string[]> {
      const rows = await db.patientProfile.findMany({
        where: { deletedAt: null, position: { not: null } },
        select: { position: true },
        distinct: ['position']
      });
      return rows.map((row) => row.position).filter((position): position is string => position !== null).sort();
    },

    /**
     * The stat cards atop the candidates list need these regardless of which page is currently
     * showing, and none of them require decrypting anything — "no medicals yet" uses Prisma's
     * relation filter (`cases: { none: {} }`) rather than fetching every case to check for an
     * empty list per candidate. `linkedUserId` scopes this the same way listCandidatesForUser
     * scopes the row list, for a patient viewer who should only see stats about their own record.
     */
    async getStats(linkedUserId?: string): Promise<{ total: number; newThisMonth: number; portalAccessGranted: number; noMedicalsYet: number }> {
      const now = new Date();
      const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
      // Combined via AND arrays (not object-spread) throughout — portalAccessGranted otherwise
      // needs its own `linkedUserId: { not: null }` clause on the exact same field a patient-scoped
      // `linkedUserId` filter already uses, and a spread would let one silently clobber the other.
      const base: Prisma.PatientProfileWhereInput[] = [{ deletedAt: null }, ...(linkedUserId ? [{ linkedUserId }] : [])];

      const [total, newThisMonth, portalAccessGranted, noMedicalsYet] = await Promise.all([
        db.patientProfile.count({ where: { AND: base } }),
        db.patientProfile.count({ where: { AND: [...base, { createdAt: { gte: startOfMonth } }] } }),
        db.patientProfile.count({ where: { AND: [...base, { linkedUserId: { not: null } }] } }),
        db.patientProfile.count({ where: { AND: [...base, { cases: { none: {} } }] } })
      ]);
      return { total, newThisMonth, portalAccessGranted, noMedicalsYet };
    },

    async save(input: CandidateInput, masterKey: Buffer): Promise<PatientProfile> {
      const record = encryptJson(masterKey, input.payload);
      const profilePayload = Buffer.from(JSON.stringify(record), 'utf8');
      const data = {
        fullName: input.fullName,
        email: input.email,
        employeeId: input.employeeId,
        dateOfBirth: input.dateOfBirth,
        contactNumber: input.contactNumber,
        createdBy: input.createdBy,
        linkedUserId: input.linkedUserId,
        status: input.status,
        position: input.position,
        profilePayload,
        // Fixed at 1 until a real key-rotation mechanism (KMS or multi-key
        // masterKey) is introduced; the column exists to support that later.
        payloadKeyVersion: 1
      };
      return db.patientProfile.upsert({
        where: { id: input.id },
        create: { id: input.id, ...data },
        update: data
      });
    }
  };
}

export const candidatesRepository = createCandidatesRepository(prisma);
