/**
 * Temporal query helpers.
 *
 * CONVENTION FOR TEMPORAL ENTITIES (Phase 3+):
 * Tables with record-validity semantics use:
 *   effectiveFrom  DateTime   — when this record becomes valid (non-null)
 *   effectiveTo    DateTime?  — when this record stops being valid (null = currently active)
 *
 * Applies to: ParticipantResidencyStatus, VendorEligibility, CorporateOwnership,
 *             ProjectOwnership (Phase 3), RightsControlFact (Phase 3).
 *
 * OVERLAP PREVENTION:
 * Enforce non-overlapping ranges at the DB level with an exclusion constraint.
 * Example (run in a migration after enabling btree_gist):
 *
 *   CREATE EXTENSION IF NOT EXISTS btree_gist;
 *
 *   ALTER TABLE participant_residency_statuses
 *     ADD CONSTRAINT no_overlapping_residency
 *     EXCLUDE USING gist (
 *       person_id        WITH =,
 *       project_id       WITH =,
 *       tstzrange(effective_from, effective_to, '[)') WITH &&
 *     );
 *
 * NULL effectiveTo is treated as infinity in the range above.
 * The application must replace NULL with a far-future date before inserting
 * if using this constraint, OR use a partial index approach.
 *
 * USAGE:
 *   import { asOf, currentlyEffective, activeDuring } from '@storyos/database';
 *
 *   // Current record for a person-project residency
 *   const residency = await prisma.participantResidencyStatus.findFirst({
 *     where: { personId, projectId, ...currentlyEffective() },
 *   });
 *
 *   // Record valid on a specific past date (for submission snapshot evaluation)
 *   const residencyAtSubmission = await prisma.participantResidencyStatus.findFirst({
 *     where: { personId, projectId, ...asOf(submissionDate) },
 *   });
 */
export interface TemporalFilter {
    effectiveFrom: {
        lte: Date;
    };
    OR: [{
        effectiveTo: null;
    }, {
        effectiveTo: {
            gt: Date;
        };
    }];
}
/**
 * Returns a Prisma WHERE fragment that matches records valid at the given date.
 * Default is the current timestamp.
 */
export declare function asOf(date?: Date): TemporalFilter;
/**
 * Shorthand for asOf(new Date()) — currently effective records.
 */
export declare function currentlyEffective(): TemporalFilter;
export interface DateRangeFilter {
    startDate: {
        lte: Date;
    };
    OR: [{
        endDate: null;
    }, {
        endDate: {
            gte: Date;
        };
    }];
}
/**
 * For business date ranges (startDate / endDate on ProductionPhase,
 * ProjectParticipantRole, etc.) where the semantics are "active during this period."
 *
 * Returns records that overlap with the given range.
 */
export declare function activeDuring(rangeStart: Date, rangeEnd: Date): DateRangeFilter;
/**
 * Records whose date range includes the given point.
 */
export declare function activeOn(date: Date): DateRangeFilter;
//# sourceMappingURL=temporal.d.ts.map