import * as fs from "fs";
import * as yaml from "js-yaml";
import { z } from "zod";
import { DataSource, Repository } from "typeorm";
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
  stepNumber: z.number(),
  dependsOn: z.number().optional()
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

    // this prevents a step from waiting on one that runs after it — would deadlock the worker
    for (const step of workflowDef.steps) {
      const dependsOnLaterStep = step.dependsOn !== undefined && step.dependsOn >= step.stepNumber;
      if (dependsOnLaterStep) {
        throw new Error(
          `Step ${step.stepNumber} cannot depend on step ${step.dependsOn}: a step must depend on an earlier step`
        );
      }
    }

    const workflowRepository = this.dataSource.getRepository(Workflow);
    const taskRepository = this.dataSource.getRepository(Task);
    const workflow = new Workflow();

    workflow.clientId = clientId;
    workflow.status = WorkflowStatus.Initial;

    const savedWorkflow = await workflowRepository.save(workflow);

    // Phase 1: create and save all tasks without dependency links
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

    const savedTasks = await taskRepository.save(tasks);

    await this.wireDependencies(workflowDef.steps, savedTasks, taskRepository);

    return savedWorkflow;
  }

  // Phase 2: wire dependencies — task IDs are only available after phase 1 saves them
  private async wireDependencies(
    steps: z.infer<typeof WorkflowStepSchema>[],
    savedTasks: Task[],
    taskRepository: Repository<Task>
  ): Promise<void> {
    const stepToTask = new Map(savedTasks.map(t => [t.stepNumber, t]));
    const tasksWithDeps = steps
      .filter(
        (step): step is z.infer<typeof WorkflowStepSchema> & { dependsOn: number } =>
          step.dependsOn !== undefined
      )
      .map(step => {
        const task = stepToTask.get(step.stepNumber)!;
        const depTask = stepToTask.get(step.dependsOn);
        if (!depTask) {
          throw new Error(
            `Step ${step.stepNumber} references unknown dependsOn stepNumber ${step.dependsOn}`
          );
        }
        task.dependency = depTask;
        return task;
      });

    if (tasksWithDeps.length > 0) {
      await taskRepository.save(tasksWithDeps);
    }
  }
}
