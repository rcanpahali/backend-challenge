import "reflect-metadata";
import express from "express";
import analysisRoutes from "../../src/routes/analysisRoutes";
import workflowRoutes from "../../src/routes/workflowRoutes";

// creates the Express app without starting the DB or the background worker.
export function setupExpressTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/analysis", analysisRoutes);
  app.use("/workflow", workflowRoutes);
  return app;
}
