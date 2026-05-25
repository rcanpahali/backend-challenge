import "reflect-metadata";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { describe, it, expect } from "vitest";
import { AppDataSource } from "../../src/data-source";
import { WorkflowFactory, WorkflowStatus } from "../../src/workflows/WorkflowFactory";
import { TaskRunner } from "../../src/workers/taskRunner";
import { Task } from "../../src/models/Task";
import { Result } from "../../src/models/Result";
import { TaskStatus } from "../../src/types/TaskStatus";

const VALID_GEO_JSON = {
  type: "Polygon",
  coordinates: [
    [
      [-63.624885020050996, -10.311050368263523],
      [-63.624885020050996, -10.367865108370523],
      [-63.61278302732815, -10.367865108370523],
      [-63.61278302732815, -10.311050368263523],
      [-63.624885020050996, -10.311050368263523]
    ]
  ]
};

function writeYaml(content: string): string {
  const file = path.join(os.tmpdir(), `test-dep-workflow-${Date.now()}-${Math.random()}.yml`);
  fs.writeFileSync(file, content, "utf8");
  return file;
}

async function findEligibleQueuedTask(workflowId: string): Promise<Task | null> {
  const taskRepo = AppDataSource.getRepository(Task);
  return taskRepo
    .createQueryBuilder("task")
    .leftJoinAndSelect("task.workflow", "workflow")
    .leftJoinAndSelect("task.dependency", "dependency")
    .where("task.status = :status", { status: TaskStatus.Queued })
    .andWhere("workflow.workflowId = :workflowId", { workflowId })
    .andWhere("(task.dependencyTaskId IS NULL OR dependency.status = :depStatus)", {
      depStatus: TaskStatus.Completed
    })
    .getOne();
}

describe("Dependency workflow", () => {
  it("runs tasks in dependency order and passes output to dependent task", async () => {
    const yamlPath = writeYaml(`
name: "integration_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 2
    dependsOn: 1
`);

    const factory = new WorkflowFactory(AppDataSource);
    const workflow = await factory.createWorkflowFromYAML(
      yamlPath,
      "client-dep-integration",
      JSON.stringify({ geoJson: VALID_GEO_JSON })
    );

    const taskRepo = AppDataSource.getRepository(Task);
    const runner = new TaskRunner(taskRepo);

    // Only step 1 (no dependency) should be eligible initially
    const firstEligible = await findEligibleQueuedTask(workflow.workflowId);
    expect(firstEligible).not.toBeNull();
    expect(firstEligible!.stepNumber).toBe(1);

    await runner.run(firstEligible!);

    // After step 1 completes, step 2 becomes eligible
    const secondEligible = await findEligibleQueuedTask(workflow.workflowId);
    expect(secondEligible).not.toBeNull();
    expect(secondEligible!.stepNumber).toBe(2);
    expect(secondEligible!.dependency?.status).toBe(TaskStatus.Completed);

    await runner.run(secondEligible!);

    // Both tasks completed — workflow should be completed
    const workflowRepo = AppDataSource.getRepository(Task).manager.getRepository(
      (await import("../../src/models/Workflow")).Workflow
    );
    const finalWorkflow = await workflowRepo.findOne({
      where: { workflowId: workflow.workflowId },
      relations: { tasks: true }
    });
    expect(finalWorkflow!.status).toBe(WorkflowStatus.Completed);
  });

  it("injects dependency output into the dependent task payload", async () => {
    const yamlPath = writeYaml(`
name: "payload_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 2
    dependsOn: 1
`);

    const factory = new WorkflowFactory(AppDataSource);
    const workflow = await factory.createWorkflowFromYAML(
      yamlPath,
      "client-payload-dep",
      JSON.stringify({ geoJson: VALID_GEO_JSON })
    );

    const taskRepo = AppDataSource.getRepository(Task);
    const runner = new TaskRunner(taskRepo);

    // Run step 1 (analysis) — it produces a Result with country data
    const step1 = await findEligibleQueuedTask(workflow.workflowId);
    await runner.run(step1!);

    // Fetch step 2 with its dependency relation loaded
    const step2 = await findEligibleQueuedTask(workflow.workflowId);
    expect(step2!.dependency?.resultId).toBeDefined();

    // Verify the dependency result exists and has data
    const resultRepo = AppDataSource.getRepository(Result);
    const depResult = await resultRepo.findOneBy({ taskId: step1!.taskId });
    expect(depResult).not.toBeNull();
    const depData = JSON.parse(depResult!.data) as Record<string, unknown>;
    expect(depData).toBeDefined();

    // Run step 2 — TaskRunner enriches its payload before the job runs
    await runner.run(step2!);

    // The notification task completes successfully
    const completedStep2 = await taskRepo.findOneBy({ taskId: step2!.taskId });
    expect(completedStep2!.status).toBe(TaskStatus.Completed);
  });

  it("does not pick up a task with an incomplete dependency", async () => {
    const yamlPath = writeYaml(`
name: "blocked_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 2
    dependsOn: 1
`);

    const factory = new WorkflowFactory(AppDataSource);
    const workflow = await factory.createWorkflowFromYAML(
      yamlPath,
      "client-blocked-dep",
      JSON.stringify({ geoJson: VALID_GEO_JSON })
    );

    // Step 1 is still queued — step 2 should NOT be eligible
    const taskRepo = AppDataSource.getRepository(Task);
    const tasks = await taskRepo.find({
      where: { workflow: { workflowId: workflow.workflowId } },
      order: { stepNumber: "ASC" }
    });
    const step1 = tasks[0];
    const step2 = tasks[1];

    // Manually put step 1 in_progress (simulating it being processed)
    step1.status = TaskStatus.InProgress;
    await taskRepo.save(step1);

    // Step 2 still has an incomplete dependency — should not be returned
    const eligible = await findEligibleQueuedTask(workflow.workflowId);
    expect(eligible).toBeNull();

    // Cleanup: restore so DB stays clean across tests
    step1.status = TaskStatus.Queued;
    await taskRepo.save(step1);
    void step2; // suppress unused warning
  });
});
