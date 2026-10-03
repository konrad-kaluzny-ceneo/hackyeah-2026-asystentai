CREATE TABLE "meta_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "meta_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"event_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"schema_version" varchar(16) NOT NULL,
	"event_name" varchar(64) NOT NULL,
	"detected_at" timestamp with time zone NOT NULL,
	"server_received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"window_started_at" timestamp with time zone NOT NULL,
	"window_ended_at" timestamp with time zone NOT NULL,
	"window_duration_ms" integer NOT NULL,
	"session_id" text NOT NULL,
	"page_view_id" text NOT NULL,
	"journey_id" text,
	"page_type" varchar(32) NOT NULL,
	"previous_page_type" varchar(32),
	"route_template" text,
	"subject_type" varchar(32),
	"subject_id" text,
	"category_id" text,
	"brand_id" text,
	"ecommerce_context" jsonb NOT NULL,
	"metrics" jsonb NOT NULL,
	"strength" double precision NOT NULL,
	"evidence_count" integer NOT NULL,
	"algorithm_version" varchar(32) NOT NULL,
	"partial_data" boolean NOT NULL,
	"consent_version" varchar(32),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "meta_events_event_id_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "meta_events_name_detected_at_idx" ON "meta_events" USING btree ("event_name","detected_at");--> statement-breakpoint
CREATE INDEX "meta_events_session_detected_at_idx" ON "meta_events" USING btree ("session_id","detected_at");--> statement-breakpoint
CREATE INDEX "meta_events_page_view_id_idx" ON "meta_events" USING btree ("page_view_id");--> statement-breakpoint
CREATE INDEX "meta_events_journey_id_idx" ON "meta_events" USING btree ("journey_id");--> statement-breakpoint
CREATE INDEX "meta_events_page_type_detected_at_idx" ON "meta_events" USING btree ("page_type","detected_at");--> statement-breakpoint
CREATE INDEX "meta_events_subject_idx" ON "meta_events" USING btree ("subject_type","subject_id");--> statement-breakpoint
CREATE INDEX "meta_events_category_detected_at_idx" ON "meta_events" USING btree ("category_id","detected_at");