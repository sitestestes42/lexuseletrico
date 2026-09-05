CREATE TABLE `order_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` varchar(32) NOT NULL,
	`productId` varchar(64) NOT NULL,
	`variant` varchar(32) NOT NULL,
	`quantity` int NOT NULL,
	`unitPriceCents` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` varchar(32) NOT NULL,
	`userId` int NOT NULL,
	`totalCents` int NOT NULL,
	`status` enum('pending','paid','failed','cancelled') NOT NULL DEFAULT 'pending',
	`providerReference` varchar(128),
	`idempotencyKey` varchar(96) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
