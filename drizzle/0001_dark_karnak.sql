CREATE TABLE `olist_connections` (
	`owner` text PRIMARY KEY NOT NULL,
	`credentials` text NOT NULL,
	`tokens` text,
	`epoch` text NOT NULL,
	`lock_id` text,
	`lock_until` integer DEFAULT 0 NOT NULL,
	`next_request` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `olist_links` (
	`owner` text NOT NULL,
	`product_id` text NOT NULL,
	`remote_id` integer NOT NULL,
	`parent_id` integer,
	`sku` text NOT NULL,
	`synced_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `olist_link_product` ON `olist_links` (`owner`,`product_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `olist_link_remote` ON `olist_links` (`owner`,`remote_id`);--> statement-breakpoint
CREATE TABLE `olist_oauth` (
	`state` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`browser` text NOT NULL,
	`epoch` text NOT NULL,
	`redirect_uri` text NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `olist_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`epoch` text NOT NULL,
	`plan` text NOT NULL,
	`state` text DEFAULT 'ready' NOT NULL,
	`expires` integer NOT NULL,
	`result` text
);
