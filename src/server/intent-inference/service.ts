import { sql } from "drizzle-orm";

import { getDb, type Database } from "@/lib/db/client";
import {
  sessionIntentSnapshots,
  type NewSessionIntentSnapshotRow,
} from "@/lib/db/schema";
import type { ValidatedIntentSnapshot } from "./validation";

export type SaveIntentSnapshotResult = Readonly<{
  acceptedSnapshotId: string | null;
  duplicate: boolean;
}>;

export async function saveIntentSnapshot(
  snapshot: ValidatedIntentSnapshot,
  options: { db?: Database } = {},
): Promise<SaveIntentSnapshotResult> {
  const db = options.db ?? getDb();
  const row = toRow(snapshot);
  const inserted = await db
    .insert(sessionIntentSnapshots)
    .values(row)
    .onConflictDoNothing({ target: sessionIntentSnapshots.snapshotId })
    .returning({ snapshotId: sessionIntentSnapshots.snapshotId });

  if (inserted.length === 0) {
    return { acceptedSnapshotId: null, duplicate: true };
  }
  return { acceptedSnapshotId: inserted[0].snapshotId, duplicate: false };
}

export function toIntentSnapshotRow(
  snapshot: ValidatedIntentSnapshot,
): NewSessionIntentSnapshotRow {
  return {
    snapshotId: snapshot.snapshotId,
    sessionId: snapshot.sessionId,
    computedAt: new Date(snapshot.computedAt),
    model: snapshot.model,
    intents: snapshot.intents,
    inputEventWindow: snapshot.inputEventWindow,
    algorithmVersion: snapshot.algorithmVersion,
  };
}

export async function assertIntentDatabaseReady(db: Database): Promise<void> {
  await db.execute(sql`select 1`);
}

function toRow(
  snapshot: ValidatedIntentSnapshot,
): NewSessionIntentSnapshotRow {
  return toIntentSnapshotRow(snapshot);
}
