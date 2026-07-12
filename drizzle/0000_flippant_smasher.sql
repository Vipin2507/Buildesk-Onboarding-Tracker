CREATE TABLE `activity_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`who` text NOT NULL,
	`what` text NOT NULL,
	`kind` text NOT NULL,
	`company_id` text,
	`project_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `activity_company_idx` ON `activity_entries` (`company_id`);--> statement-breakpoint
CREATE INDEX `activity_project_idx` ON `activity_entries` (`project_id`);--> statement-breakpoint
CREATE TABLE `app_config` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text DEFAULT '{}' NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `approval_flows` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`stages_json` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `attendance_records` (
	`id` text PRIMARY KEY NOT NULL,
	`file_name` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `boqs` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`project_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `companies` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`designation` text NOT NULL,
	`phone` text NOT NULL,
	`email` text NOT NULL,
	`city` text NOT NULL,
	`office_address` text,
	`gst_number` text,
	`billing_info` text,
	`onboarding_manager_id` text NOT NULL,
	`csm_id` text NOT NULL,
	`status` text NOT NULL,
	`agreement_date` text NOT NULL,
	`go_live_target` text NOT NULL,
	`plan_expiry` text NOT NULL,
	`plan` text NOT NULL,
	`health` text NOT NULL,
	`renewed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `company_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`project_id` text,
	`file_name` text NOT NULL,
	`purpose` text NOT NULL,
	`category` text NOT NULL,
	`context` text,
	`record_count` integer,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_company_idx` ON `company_attachments` (`company_id`);--> statement-breakpoint
CREATE TABLE `company_modules` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`module_key` text NOT NULL,
	`label` text NOT NULL,
	`opted_in` integer DEFAULT false NOT NULL,
	`opted_on_date` text,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `company_modules_company_idx` ON `company_modules` (`company_id`);--> statement-breakpoint
CREATE TABLE `company_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`project_id` text,
	`body` text NOT NULL,
	`author` text NOT NULL,
	`pinned` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notes_company_idx` ON `company_notes` (`company_id`);--> statement-breakpoint
CREATE TABLE `contractors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `customer_app_configs` (
	`project_id` text PRIMARY KEY NOT NULL,
	`mode` text DEFAULT 'buildesk' NOT NULL,
	`app_name` text NOT NULL,
	`primary_color` text DEFAULT '#009BFF' NOT NULL,
	`logo_url` text DEFAULT '' NOT NULL,
	`support_email` text DEFAULT '' NOT NULL,
	`support_phone` text DEFAULT '' NOT NULL,
	`publish_status` text DEFAULT 'draft' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `employees` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`region` text NOT NULL,
	`email` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `integrations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`connected` integer DEFAULT false NOT NULL,
	`tested` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `labor` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `onboarding_checklist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`section` text NOT NULL,
	`label` text NOT NULL,
	`collected` integer DEFAULT false NOT NULL,
	`uploaded` integer DEFAULT false NOT NULL,
	`live` integer DEFAULT false NOT NULL,
	`remarks` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_project_idx` ON `onboarding_checklist_items` (`project_id`);--> statement-breakpoint
CREATE TABLE `other_charges` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `other_charges_project_idx` ON `other_charges` (`project_id`);--> statement-breakpoint
CREATE TABLE `post_sales_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`company_id` text NOT NULL,
	`project_number` text NOT NULL,
	`project_name` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_sales_company_idx` ON `post_sales_projects` (`company_id`);--> statement-breakpoint
CREATE TABLE `post_sales_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`post_sales_project_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`requires_template` integer DEFAULT false NOT NULL,
	`template_status` text NOT NULL,
	`template_sent_on` text,
	`upload_status` text NOT NULL,
	`uploaded_file_json` text,
	`approval_status` text NOT NULL,
	`approved_by` text,
	`approved_on` text,
	`remarks` text,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`post_sales_project_id`) REFERENCES `post_sales_projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_sales_steps_project_idx` ON `post_sales_steps` (`post_sales_project_id`);--> statement-breakpoint
CREATE TABLE `project_manual_progress` (
	`project_id` text PRIMARY KEY NOT NULL,
	`contact_person` text,
	`contact_number` text,
	`checks_json` text DEFAULT '{}' NOT NULL,
	`remarks` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`company_id` text NOT NULL,
	`type` text NOT NULL,
	`units` integer DEFAULT 0 NOT NULL,
	`city` text NOT NULL,
	`rera` text NOT NULL,
	`status` text NOT NULL,
	`current_step` integer DEFAULT 0 NOT NULL,
	`go_live_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `projects_company_idx` ON `projects` (`company_id`);--> statement-breakpoint
CREATE TABLE `purchase_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`supplier_id` text NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `suppliers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`contact` text NOT NULL,
	`phone` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`priority` text NOT NULL,
	`status` text NOT NULL,
	`raised_on` text NOT NULL,
	`eta` text NOT NULL,
	`developer_id` text,
	`company_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `training_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`trainer_id` text NOT NULL,
	`company_id` text NOT NULL,
	`date` text NOT NULL,
	`attendance` text NOT NULL,
	`recording` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`event` text NOT NULL,
	`channel` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `unit_uploads` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`type` text NOT NULL,
	`file_name` text NOT NULL,
	`record_count` integer DEFAULT 0 NOT NULL,
	`uploaded_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `unit_uploads_project_idx` ON `unit_uploads` (`project_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'Viewer' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`avatar_url` text,
	`phone` text,
	`job_title` text,
	`department` text,
	`timezone` text,
	`bio` text,
	`notify_email` integer DEFAULT true,
	`notify_in_app` integer DEFAULT true,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`number` text NOT NULL,
	`contractor_id` text NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`status` text NOT NULL,
	`amount` real DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
