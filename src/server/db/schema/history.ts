import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { authUser } from "./auth";

export const analysisHistory = pgTable(
  "analysis_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    problem: text("problem").notNull(),
    code: text("code").notNull(),
    userThought: text("user_thought").notNull().default(""),
    failureInput: text("failure_input").notNull().default(""),
    expectedOutput: text("expected_output").notNull().default(""),
    actualOutput: text("actual_output").notNull().default(""),
    schemaVersion: text("schema_version").notNull(),
    result: jsonb("result").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("analysis_history_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);
