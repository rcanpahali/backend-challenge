import "reflect-metadata";
import express from "express";
import analysisRoutes from "../routes/analysisRoutes";

// creates the Express app without starting the DB or the background worker.
export function setupExpressTestApp() {
  const app = express();
  app.use(express.json());
  app.use("/analysis", analysisRoutes);
  return app;
}
