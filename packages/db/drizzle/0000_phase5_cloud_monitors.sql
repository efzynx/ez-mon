CREATE TABLE "agent_state" (
	"agent_id" uuid PRIMARY KEY NOT NULL,
	"cpu_pct" real,
	"cpu_cores" json,
	"mem_used_mb" integer,
	"mem_total_mb" integer,
	"disk_used_mb" integer,
	"disk_total_mb" integer,
	"load_1" real,
	"net_rx_bps" bigint,
	"net_tx_bps" bigint,
	"containers_running" integer,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "agents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"hostname" text,
	"os" text,
	"arch" text,
	"version" text,
	"status" text DEFAULT 'unknown' NOT NULL,
	"last_seen_at" timestamp with time zone,
	"offline_deadline_at" timestamp with time zone,
	"heartbeat_interval_sec" integer DEFAULT 30 NOT NULL,
	"grace_multiplier" integer DEFAULT 3 NOT NULL,
	"metrics_interval_sec" integer DEFAULT 60 NOT NULL,
	"last_ip" text,
	"country" text,
	"city" text,
	"lat" real,
	"lon" real,
	"show_on_status_page" boolean DEFAULT true NOT NULL,
	"tags" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alert_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"channel_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"sent_at" timestamp with time zone,
	"response_code" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_check_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"status" text NOT NULL,
	"http_status" smallint,
	"latency_ms" integer,
	"error" text,
	"keyword_found" boolean,
	"tls_days_remaining" smallint,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloud_monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"type" text DEFAULT 'http' NOT NULL,
	"interval_sec" smallint DEFAULT 60 NOT NULL,
	"timeout_sec" smallint DEFAULT 10 NOT NULL,
	"keyword" text,
	"expected_status" smallint,
	"status" text DEFAULT 'active' NOT NULL,
	"last_status" text DEFAULT 'unknown' NOT NULL,
	"next_check_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"last_latency_ms" integer,
	"tls_expires_at" timestamp with time zone,
	"show_on_status_page" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"agent_id" uuid NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "metric_buckets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agent_id" uuid NOT NULL,
	"bucket_start" timestamp with time zone NOT NULL,
	"bucket_size_sec" integer DEFAULT 60 NOT NULL,
	"cpu_avg" real,
	"cpu_max" real,
	"cpu_cores_avg" json,
	"mem_avg" real,
	"disk_avg" real,
	"load_avg" real,
	"rx_sum" bigint,
	"tx_sum" bigint,
	"sample_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"config_json" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notify_on" text DEFAULT 'both' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"tags" json
);
--> statement-breakpoint
CREATE TABLE "status_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"title" text DEFAULT 'System Status' NOT NULL,
	"description" text,
	"published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "agent_state" ADD CONSTRAINT "agent_state_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agents" ADD CONSTRAINT "agents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert_events" ADD CONSTRAINT "alert_events_channel_id_notification_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_check_results" ADD CONSTRAINT "cloud_check_results_monitor_id_cloud_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."cloud_monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cloud_monitors" ADD CONSTRAINT "cloud_monitors_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metric_buckets" ADD CONSTRAINT "metric_buckets_agent_id_agents_id_fk" FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channels" ADD CONSTRAINT "notification_channels_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "status_pages" ADD CONSTRAINT "status_pages_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agents_project_id" ON "agents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_agents_status" ON "agents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_agents_offline_deadline" ON "agents" USING btree ("offline_deadline_at");--> statement-breakpoint
CREATE INDEX "idx_alert_events_incident" ON "alert_events" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "idx_cloud_check_results_monitor_time" ON "cloud_check_results" USING btree ("monitor_id","checked_at");--> statement-breakpoint
CREATE INDEX "idx_cloud_check_results_status" ON "cloud_check_results" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cloud_monitors_project_id" ON "cloud_monitors" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_cloud_monitors_next_check" ON "cloud_monitors" USING btree ("next_check_at");--> statement-breakpoint
CREATE INDEX "idx_cloud_monitors_status" ON "cloud_monitors" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incidents_project_id" ON "incidents" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_agent_id" ON "incidents" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_incidents_status" ON "incidents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_incidents_started_at" ON "incidents" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "idx_metric_buckets_agent_time" ON "metric_buckets" USING btree ("agent_id","bucket_start");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_metric_buckets_unique" ON "metric_buckets" USING btree ("agent_id","bucket_start","bucket_size_sec");--> statement-breakpoint
CREATE INDEX "idx_notification_channels_project" ON "notification_channels" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "idx_projects_user_id" ON "projects" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_projects_user_slug" ON "projects" USING btree ("user_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_status_pages_project" ON "status_pages" USING btree ("project_id");