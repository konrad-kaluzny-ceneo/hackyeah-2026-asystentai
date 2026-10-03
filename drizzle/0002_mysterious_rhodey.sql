CREATE TABLE "session_intent_snapshots" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "session_intent_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"snapshot_id" text NOT NULL,
	"session_id" text NOT NULL,
	"computed_at" timestamp with time zone NOT NULL,
	"server_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model" varchar(64) NOT NULL,
	"intents" jsonb NOT NULL,
	"input_event_window" jsonb NOT NULL,
	"algorithm_version" varchar(32) NOT NULL,
	CONSTRAINT "session_intent_snapshots_snapshot_id_unique" UNIQUE("snapshot_id")
);
--> statement-breakpoint
CREATE INDEX "session_intent_snapshots_session_computed_at_idx" ON "session_intent_snapshots" USING btree ("session_id","computed_at");--> statement-breakpoint
CREATE INDEX "session_intent_snapshots_computed_at_idx" ON "session_intent_snapshots" USING btree ("computed_at");