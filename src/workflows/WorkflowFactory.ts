import * as fs from "fs";
import * as yaml from "js-yaml";
import { z } from "zod";
import { DataSource } from "typeorm";
import logger from "../logger";
import { Workflow } from "../models/Workflow";
import { Task } from "../models/Task";
import { TaskStatus } from "../types/TaskStatus";

export enum WorkflowStatus {
  Initial = "initial",
  InProgress = "in_progress",
  Completed = "completed",
  Failed = "failed"
}

// yaml.load() returns `unknown`. Zod validates the actual shape before we use it, otherwise it silently fails on invalid input.
const WorkflowStepSchema = z.object({
  taskType: z.string(),
  stepNumber: z.number()
});

const WorkflowDefinitionSchema = z.object({
  name: z.string(),
  steps: z.array(WorkflowStepSchema)
});

export class WorkflowFactory {
  constructor(private dataSource: DataSource) {}

  /**
   * Creates a workflow by reading a YAML file and constructing the Workflow and Task entities.
   * @param filePath - Path to the YAML file.
   * @param clientId - Client identifier for the workflow.
   * @param payload - The serialized JSON payload string for tasks.
   * @returns A promise that resolves to the created Workflow.
   */
  async createWorkflowFromYAML(
    filePath: string,
    clientId: string,
    payload: string
  ): Promise<Workflow> {
    const fileContent = fs.readFileSync(filePath, "utf8");
    const parsed = WorkflowDefinitionSchema.safeParse(yaml.load(fileContent));
    if (!parsed.success) {
      logger.error({ err: parsed.error }, "Invalid workflow YAML definition");
      throw new Error("Invalid workflow YAML definition");
    }

    const workflowDef = parsed.data;
    const workflowRepository = this.dataSource.getRepository(Workflow);
    const taskRepository = this.dataSource.getRepository(Task);
    const workflow = new Workflow();

    workflow.clientId = clientId;
    workflow.status = WorkflowStatus.Initial;

    const savedWorkflow = await workflowRepository.save(workflow);

    const tasks: Task[] = workflowDef.steps.map(step => {
      const task = new Task();
      task.clientId = clientId;
      task.payload = payload;
      task.status = TaskStatus.Queued;
      task.taskType = step.taskType;
      task.stepNumber = step.stepNumber;
      task.workflow = savedWorkflow;
      return task;
    });

    await taskRepository.save(tasks);

    return savedWorkflow;
  }
}
