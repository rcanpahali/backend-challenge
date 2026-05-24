import "reflect-metadata";
import express from "express";
import { config } from "./config";
import logger from "./logger";
import analysisRoutes from "./routes/analysisRoutes";
import defaultRoute from "./routes/defaultRoute";
import { taskWorker } from "./workers/taskWorker";
import { AppDataSource } from "./data-source"; // Import the DataSource instance

const app = express();
app.use(express.json());
app.use("/analysis", analysisRoutes);
app.use("/", defaultRoute);

void AppDataSource.initialize()
  .then(() => {
    void taskWorker();

    app.listen(config.PORT, () => {
      logger.info(`Server is running at http://localhost:${config.PORT}`);
    });
  })
  .catch(error => logger.error(error, "Failed to initialize database"));
