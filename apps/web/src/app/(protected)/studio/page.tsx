/**
 * Studio Page (Server Component)
 *
 * The main multi-track DAW interface where users:
 * - Create and manage audio sessions
 * - Import and arrange audio clips on timeline
 * - Chain plugins as insert effects
 * - Mix tracks with volume, pan, mute, solo
 * - Record from microphone
 * - Export finished projects
 *
 * SSR Features:
 * - Accepts ?sessionId= query param for session rehydration
 * - Session data loaded client-side from IndexedDB
 */

import { StudioClientWrapper } from "./client-wrapper";

interface PageProps {
  searchParams: Promise<{ sessionId?: string }>;
}

export default async function StudioPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const sessionId = params.sessionId;

  return <StudioClientWrapper initialSessionId={sessionId ?? null} />;
}
