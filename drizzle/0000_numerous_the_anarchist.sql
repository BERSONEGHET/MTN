CREATE TABLE `counters` (
	`owner` text PRIMARY KEY NOT NULL,
	`value` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `models` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`prefix` text NOT NULL,
	`seq` integer NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mutations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`model_id` text,
	`name` text NOT NULL,
	`gender` text NOT NULL,
	`seq` integer,
	`sku` text NOT NULL,
	`sku_key` text,
	`color` text NOT NULL,
	`size` text NOT NULL,
	`supplier` text DEFAULT '' NOT NULL,
	`supplier_ref` text DEFAULT '' NOT NULL,
	`quantity` integer DEFAULT 0 NOT NULL,
	`cost` integer DEFAULT 0 NOT NULL,
	`price` integer,
	`legacy` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_new_sku` ON `products` (`owner`,`sku_key`);--> statement-breakpoint
CREATE TABLE `sku_history` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`product_id` text NOT NULL,
	`old_sku` text NOT NULL,
	`new_sku` text NOT NULL,
	`changed_at` text NOT NULL
);
