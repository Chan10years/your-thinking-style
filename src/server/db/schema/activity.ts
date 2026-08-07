import {
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import { authUser } from "./auth";

export const dailyUserActivity = pgTable(
  "daily_user_activity",
  {
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    activityDate: date("activity_date").notNull(),
    successfulAnalyses: integer("successful_analyses").notNull().default(0),
    loginCount: integer("login_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.activityDate] }),
    index("daily_user_activity_date_idx").on(table.activityDate),
  ],
);
