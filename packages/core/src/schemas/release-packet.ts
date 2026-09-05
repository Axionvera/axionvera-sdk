import * as v from 'valibot';

/**
 * Schema for a single artifact entry in the release packet manifest.
 */
export const ReleaseArtifactSchema = v.object({
  path: v.string(),
  type: v.union([
    v.literal('doc'),
    v.literal('example'),
    v.literal('schema'),
    v.literal('dist'),
    v.literal('fixture')
  ]),
  description: v.string(),
  checksum: v.optional(v.string())
});

/**
 * Schema for the release packet manifest.
 * Collects non-secret SDK readiness artifacts for maintainer review.
 */
export const ReleasePacketManifestSchema = v.object({
  version: v.string(),
  timestamp: v.string(),
  environment: v.string(),
  artifacts: v.array(ReleaseArtifactSchema),
  readinessSummary: v.object({
    lint: v.boolean(),
    typecheck: v.boolean(),
    build: v.boolean(),
    test: v.boolean()
  }),
  maintainerNotes: v.optional(v.string())
});

export type ReleaseArtifact = v.InferOutput<typeof ReleaseArtifactSchema>;
export type ReleasePacketManifest = v.InferOutput<typeof ReleasePacketManifestSchema>;
