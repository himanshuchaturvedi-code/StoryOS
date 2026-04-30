-- OPSTC_REGIONAL mirrored OFTTC's outside-GTA regional bonus; Ontario OPSTC does not use that mechanism.
-- Remove the requirement and dependents so OPSTC eligibility is no longer falsely gated.

DELETE FROM "submission_evidence" se
WHERE se."requirementId" IN (
  SELECT pr.id FROM "program_requirements" pr
  INNER JOIN "program_versions" pv ON pr."programVersionId" = pv.id
  INNER JOIN "programs" p ON pv."programId" = p.id
  WHERE p.code = 'OPSTC' AND pr.code = 'OPSTC_REGIONAL'
);

DELETE FROM "requirement_assessments" ra
WHERE ra."requirementId" IN (
  SELECT pr.id FROM "program_requirements" pr
  INNER JOIN "program_versions" pv ON pr."programVersionId" = pv.id
  INNER JOIN "programs" p ON pv."programId" = p.id
  WHERE p.code = 'OPSTC' AND pr.code = 'OPSTC_REGIONAL'
);

DELETE FROM "program_requirements" pr
USING "program_versions" pv, "programs" p
WHERE pr."programVersionId" = pv.id
  AND pv."programId" = p.id
  AND p.code = 'OPSTC'
  AND pr.code = 'OPSTC_REGIONAL';

-- Align sort order after removing the skipped slot (formerly 5).
UPDATE "program_requirements" pr
SET "sortOrder" = 4,
    "updatedAt" = CURRENT_TIMESTAMP
FROM "program_versions" pv,
     "programs" p
WHERE pr."programVersionId" = pv.id
  AND pv."programId" = p.id
  AND p.code = 'OPSTC'
  AND pr.code = 'OPSTC_FORMAT';
