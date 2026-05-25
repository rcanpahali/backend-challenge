import { Router } from "express";
import { AppDataSource } from "../data-source";
import { WorkflowRepository } from "../repositories/WorkflowRepository";
import { TaskStatus } from "../types/TaskStatus";
import { WorkflowStatus } from "../workflows/WorkflowFactory";
import logger from "../logger";

const router = Router();
const workflowRepository = new WorkflowRepository(AppDataSource);

router.get("/:id/status", async (req, res) => {
  try {
    const workflow = await workflowRepository.findWithTasks(req.params.id);

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    res.json({
      workflowId: workflow.workflowId,
      status: workflow.status,
      completedTasks: workflow.tasks.filter(t => t.status === TaskStatus.Completed).length,
      totalTasks: workflow.tasks.length
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching workflow status");
    res.status(500).json({ message: "Failed to fetch workflow status" });
  }
});

router.get("/:id/results", async (req, res) => {
  try {
    const workflow = await workflowRepository.findById(req.params.id);

    if (!workflow) {
      res.status(404).json({ message: "Workflow not found" });
      return;
    }

    // results are only available once the workflow is done — client should poll /status first
    if (workflow.status !== WorkflowStatus.Completed && workflow.status !== WorkflowStatus.Failed) {
      res.status(400).json({ message: "Workflow is not yet completed" });
      return;
    }

    let finalResult: unknown = null;
    if (workflow.finalResult) {
      try {
        finalResult = JSON.parse(workflow.finalResult) as unknown;
      } catch {
        logger.error({ workflowId: workflow.workflowId }, "Failed to parse finalResult");
        res.status(500).json({ message: "Failed to parse workflow result" });
        return;
      }
    }

    res.json({
      workflowId: workflow.workflowId,
      status: workflow.status,
      finalResult
    });
  } catch (error: unknown) {
    logger.error({ err: error }, "Error fetching workflow results");
    res.status(500).json({ message: "Failed to fetch workflow results" });
  }
});

export default router;
