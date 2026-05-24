import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DB_PATH: z.string().default("data/database.sqlite"),
  DB_DROP_SCHEMA: z
    .enum(["true", "false"])
    .default("false")
    .transform(v => v === "true"),
  DB_LOGGING: z
    .enum(["true", "false"])
    .default("false")
    .transform(v => v === "true"),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(5000)
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map(issue => `  ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");

  throw new Error(`Invalid environment variables:\n${issues}`);
}

export const config = parsed.data;
