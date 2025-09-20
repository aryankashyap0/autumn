import {
  pgTable,
  text,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { collatePgColumn } from "../../db/utils.js";

export const autoTopUpHistory = pgTable(
  "auto_top_up_history",
  {
    id: text().primaryKey().notNull(),
    customer_id: text("customer_id").notNull(),
    product_id: text("product_id").notNull(),
    threshold: numeric({ mode: "number" }).notNull(),
    top_up_amount: numeric({ mode: "number" }).notNull(),
    charged_amount: numeric({ mode: "number" }).notNull(),
    stripe_invoice_id: text("stripe_invoice_id"),
    status: text().notNull().default("pending"), // pending, completed, failed
    created_at: numeric({ mode: "number" }).notNull().default(sql`extract(epoch from now())`),
    completed_at: numeric({ mode: "number" }),
    error_message: text("error_message"),
  },
  (table) => [
    index("idx_auto_top_up_customer_id").on(table.customer_id),
    index("idx_auto_top_up_product_id").on(table.product_id),
    index("idx_auto_top_up_status").on(table.status),
    index("idx_auto_top_up_created_at").on(table.created_at),
  ]
);

collatePgColumn(autoTopUpHistory.id, "C");
