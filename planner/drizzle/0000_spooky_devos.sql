CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_household_name` ON `categories` (`household_id`,`name`);--> statement-breakpoint
CREATE TABLE `households` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`currency` text DEFAULT 'CAD' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invitations` (
	`hash` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitation_household` ON `invitations` (`household_id`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`household_id` text NOT NULL,
	`name` text NOT NULL,
	`slot` integer NOT NULL,
	`opening_cents` integer DEFAULT 0 NOT NULL,
	`opening_date` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "member_slot" CHECK("members"."slot" IN (1,2))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_user_id_unique` ON `members` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_household_slot` ON `members` (`household_id`,`slot`);--> statement-breakpoint
CREATE TABLE `records` (
	`id` text PRIMARY KEY NOT NULL,
	`household_id` text NOT NULL,
	`owner_id` text,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`date` text NOT NULL,
	`end_date` text,
	`frequency` text DEFAULT 'once' NOT NULL,
	`category_id` text,
	`split_bps` integer DEFAULT 5000 NOT NULL,
	`payer_id` text,
	`note` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`balance_cents` integer,
	`saved_cents` integer DEFAULT 0 NOT NULL,
	`source_id` text,
	`occurrence_date` text,
	`completed` integer DEFAULT 0 NOT NULL,
	`remind_days` integer DEFAULT 3 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`household_id`) REFERENCES `households`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`owner_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`payer_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "record_private_debt_income" CHECK("records"."kind" NOT IN ('debt','payday') OR "records"."owner_id" IS NOT NULL),
	CONSTRAINT "record_shared_funding_settlement" CHECK("records"."kind" NOT IN ('funding','settlement') OR "records"."owner_id" IS NULL),
	CONSTRAINT "record_amount" CHECK("records"."amount_cents" >= 0 AND "records"."amount_cents" <= 1000000000),
	CONSTRAINT "record_split" CHECK("records"."split_bps" BETWEEN 0 AND 10000)
);
--> statement-breakpoint
CREATE INDEX `records_household_owner_date` ON `records` (`household_id`,`owner_id`,`date`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_payment_occurrence` ON `records` (`source_id`,`occurrence_date`);--> statement-breakpoint
CREATE UNIQUE INDEX `records_budget_private` ON `records` (`household_id`,`owner_id`,`category_id`,`date`) WHERE "records"."kind" = 'budget' AND "records"."owner_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `records_budget_shared` ON `records` (`household_id`,`category_id`,`date`) WHERE "records"."kind" = 'budget' AND "records"."owner_id" IS NULL;