ALTER TABLE `users` ADD `school` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `department` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `plan` text DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `khbd_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `ppct_used` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
UPDATE `users` SET `status` = 'active' WHERE `role` = 'user' AND `status` = 'pending';--> statement-breakpoint
UPDATE `users` SET `plan` = 'unlimited' WHERE `role` = 'admin';
