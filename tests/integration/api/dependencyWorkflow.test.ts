import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { AppDataSource } from "../../../src/data-source";
import { WorkflowFactory, WorkflowStatus } from "../../../src/workflows/WorkflowFactory";
import { Workflow } from "../../../src/models/Workflow";
import { createTaskRunner } from "../../../src/workers/taskRunner";
import { Task } from "../../../src/models/Task";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { VALID_GEO_JSON, writeYaml, findEligibleQueuedTask } from "../../helpers/utils";

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

    const runner = createTaskRunner(AppDataSource);

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
    const workflowRepo = AppDataSource.getRepository(Workflow);
    const finalWorkflow = await workflowRepo.findOne({
      where: { workflowId: workflow.workflowId },
      relations: { tasks: true }
    });
    expect(finalWorkflow!.status).toBe(WorkflowStatus.Completed);
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

    // Manually put step 1 in_progress (simulating it being processed)
    step1.status = TaskStatus.InProgress;
    await taskRepo.save(step1);

    // Step 2 still has an incomplete dependency — should not be returned
    const eligible = await findEligibleQueuedTask(workflow.workflowId);
    expect(eligible).toBeNull();

    // Cleanup: restore so DB stays clean across tests
    step1.status = TaskStatus.Queued;
    await taskRepo.save(step1);
  });
});
