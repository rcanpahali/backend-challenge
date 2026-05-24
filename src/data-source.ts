import { DataSource } from "typeorm";
import { config } from "./config";
import { Task } from "./models/Task";
import { Result } from "./models/Result";
import { Workflow } from "./models/Workflow";

export const AppDataSource = new DataSource({
  type: "better-sqlite3",
  database: config.DB_PATH,
  dropSchema: config.DB_DROP_SCHEMA,
  entities: [Task, Result, Workflow],
  synchronize: true,
  logging: config.DB_LOGGING
});
