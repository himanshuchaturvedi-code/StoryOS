/**
 * Calculator feature flags.
 *
 * These are read once at startup from environment variables.
 * They control dual-path evaluation during the derived-roles migration.
 */
export const FeatureFlags = {
  /**
   * When true, the KeyCreativeCalculator uses derived budget roles as the
   * authoritative result. Both paths still run; mismatches are logged.
   *
   * When false (default), the legacy participant-role path is authoritative.
   * The derived path runs in parallel and any mismatch is surfaced in trace.
   *
   * Set via environment variable: USE_DERIVED_ROLES=true
   */
  USE_DERIVED_ROLES: process.env.USE_DERIVED_ROLES === 'true',
} as const;
