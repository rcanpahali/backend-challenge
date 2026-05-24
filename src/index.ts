import "reflect-metadata";
import express from "express";
import pinoHttp from "pino-http";
import { config } from "./config";
import logger from "./logger";
import analysisRoutes from "./routes/analysisRoutes";
import defaultRoute from "./routes/defaultRoute";
import { taskWorker } from "./workers/taskWorker";
import { AppDataSource } from "./data-source";

const app = express();
app.use(express.json());
app.use(pinoHttp({ logger }));
app.use("/analysis", analysisRoutes);
app.use("/", defaultRoute);

void AppDataSource.initialize()
  .then(() => {
    void taskWorker();

    const server = app.listen(config.PORT, () => {
      logger.info(`Server is running at http://localhost:${config.PORT}`);
    });

    const shutdown = async () => {
      logger.info("Shutting down gracefully...");
      server.close();
      await AppDataSource.destroy();
      process.exit(0);
    };

    process.on("SIGTERM", () => void shutdown());
    process.on("SIGINT", () => void shutdown());
  })
  .catch(error => logger.error(error, "Failed to initialize database"));
