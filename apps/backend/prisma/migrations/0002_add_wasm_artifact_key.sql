-- Add wasmArtifactKey column to Project table
-- This column stores the R2 key for the WASM artifact (independent from VST3 artifact)

ALTER TABLE "Project" ADD COLUMN "wasmArtifactKey" TEXT;
