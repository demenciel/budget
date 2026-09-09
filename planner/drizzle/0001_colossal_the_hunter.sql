CREATE TABLE `agreements` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`creator_id` text NOT NULL,
	`approved_by` text,
	`carrier_id` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`split_bps` integer NOT NULL,
	`date` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`creator_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`approved_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`carrier_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "agreement_amount" CHECK("agreements"."amount_cents">0),
	CONSTRAINT "agreement_split" CHECK("agreements"."split_bps" BETWEEN 0 AND 10000),
	CONSTRAINT "agreement_second_person" CHECK("agreements"."approved_by" IS NULL OR "agreements"."approved_by" != "agreements"."creator_id")
);
--> statement-breakpoint
CREATE INDEX `agreements_household` ON `agreements` (`household_id`);--> statement-breakpoint
CREATE TABLE `joint_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`member_id` text NOT NULL,
	`kind` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`source_id` text,
	`agreement_id` text,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "joint_entry_amount" CHECK("joint_entries"."amount_cents">0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `joint_entries_source_id_unique` ON `joint_entries` (`source_id`);--> statement-breakpoint
CREATE INDEX `joint_entries_household_date` ON `joint_entries` (`household_id`,`date`);--> statement-breakpoint
ALTER TABLE `households` ADD `cycle_anchor` text DEFAULT '2026-09-09' NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `joint_opening_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `joint_opening_date` text DEFAULT '2026-09-09' NOT NULL;--> statement-breakpoint
ALTER TABLE `households` ADD `joint_target_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `fixed_reserve_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `allowance_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `second_day` integer DEFAULT 15 NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `dependable` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `received` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `account` text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `payment_method` text DEFAULT 'debit' NOT NULL;--> statement-breakpoint
ALTER TABLE `records` ADD `spending_bucket` text DEFAULT 'fixed' NOT NULL;