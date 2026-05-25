import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../data-source";
import { WorkflowFactory } from "../workflows/WorkflowFactory";
import logger from "../logger";
import path from "path";

const router = Router();
const workflowFactory = new WorkflowFactory(AppDataSource);

const AnalysisRequestSchema = z.object({
  clientId: z.string().min(1),
  geoJson: z.record(z.string(), z.unknown())
});

router.post("/", async (req, res) => {
  const parsed = AnalysisRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid request body", errors: parsed.error.issues });
    return;
  }

  const { clientId, geoJson } = parsed.data;
  const workflowFile = path.join(__dirname, "../workflows/report_workflow.yml");

  try {
    const workflow = await workflowFactory.createWorkflowFromYAML(
      workflowFile,
      clientId,
      JSON.stringify({ geoJson })
    );

    // 202 Accepted — workflow is queued, not done yet
    res.status(202).json({
      workflowId: workflow.workflowId,
      message: "Workflow created and tasks queued from YAML definition."
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error creating workflow");
    res.status(500).json({ message: "Failed to create workflow" });
  }
});

export default router;
