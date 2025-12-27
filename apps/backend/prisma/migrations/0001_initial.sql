-- vAIst Initial Schema Migration
-- AI-powered VST3 Plugin Generator

-- User Management (BetterAuth compatible)
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "email" TEXT NOT NULL UNIQUE,
    "name" TEXT,
    "image" TEXT,
    "emailVerified" INTEGER NOT NULL DEFAULT 0,
    "preferredModel" TEXT NOT NULL DEFAULT 'gemini-3-flash-preview',
    "encryptedApiKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "Account" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "idToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
    UNIQUE("providerId", "accountId")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL UNIQUE,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "Verification" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Plugin Projects
CREATE TABLE IF NOT EXISTS "Project" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "userId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "approvedPlan" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "githubRunId" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "artifactKey" TEXT,
    "artifactUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");
CREATE INDEX IF NOT EXISTS "Project_status_idx" ON "Project"("status");

-- Chat Messages (Plan Negotiation)
CREATE TABLE IF NOT EXISTS "ChatMessage" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "projectId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "planJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChatMessage_projectId_idx" ON "ChatMessage"("projectId");

-- Build Logs (Streamed from GitHub Actions)
CREATE TABLE IF NOT EXISTS "BuildLog" (
    "id" TEXT PRIMARY KEY NOT NULL,
    "projectId" TEXT NOT NULL,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'INFO',
    "message" TEXT NOT NULL,
    "step" TEXT,
    FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BuildLog_projectId_idx" ON "BuildLog"("projectId");
CREATE INDEX IF NOT EXISTS "BuildLog_projectId_timestamp_idx" ON "BuildLog"("projectId", "timestamp");
