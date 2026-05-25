import "reflect-metadata";
import path from "path";
import { describe, it, expect } from "vitest";
import { AppDataSource } from "../../../src/data-source";
import { Workflow } from "../../../src/models/Workflow";
import { Task } from "../../../src/models/Task";
import { Result } from "../../../src/models/Result";
import { WorkflowStatus, WorkflowFactory } from "../../../src/workflows/WorkflowFactory";
import { createTaskRunner } from "../../../src/workers/taskRunner";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { VALID_GEO_JSON } from "../../helpers/utils";

describe("Workflow execution", () => {
  it("runs all tasks and marks the workflow completed", async () => {
    const factory = new WorkflowFactory(AppDataSource);
    const workflowYaml = path.join(__dirname, "../../../src/workflows/multi_task_workflow.yml");

    const workflow = await factory.createWorkflowFromYAML(
      workflowYaml,
      "client-runner",
      JSON.stringify({ geoJson: VALID_GEO_JSON })
    );

    const taskRepo = AppDataSource.getRepository(Task);
    const tasks = await taskRepo.find({
      where: { workflow: { workflowId: workflow.workflowId } },
      relations: { workflow: true },
      order: { stepNumber: "ASC" }
    });

    expect(tasks).toHaveLength(2);

    const runner = createTaskRunner(AppDataSource);
    for (const task of tasks) {
      await runner.run(task);
    }

    // All tasks should be completed with a Result saved
    const resultRepo = AppDataSource.getRepository(Result);
    for (const task of tasks) {
      const result = await resultRepo.findOneBy({ taskId: task.taskId });
      expect(result).not.toBeNull();
      expect(result!.data).toBeDefined();
    }

    // Workflow should now be completed with finalResult populated
    const workflowRepo = AppDataSource.getRepository(Workflow);
    const finalWorkflow = await workflowRepo.findOne({
      where: { workflowId: workflow.workflowId },
      relations: { tasks: true }
    });

    expect(finalWorkflow!.status).toBe(WorkflowStatus.Completed);
    expect(finalWorkflow!.tasks.every(t => t.status === TaskStatus.Completed)).toBe(true);

    const finalResult = finalWorkflow!.finalResult
      ? (JSON.parse(finalWorkflow!.finalResult) as { workflowId: string; tasks: unknown[] })
      : null;
    expect(finalResult).not.toBeNull();
    expect(finalResult!.workflowId).toBe(workflow.workflowId);
    expect(finalResult!.tasks).toHaveLength(2);
  });
});
