import "reflect-metadata";
import { describe, it, expect } from "vitest";
import { AppDataSource } from "../../../src/data-source";
import { WorkflowFactory } from "../../../src/workflows/WorkflowFactory";
import { Task } from "../../../src/models/Task";
import { writeYaml } from "../../helpers/utils";

describe("WorkflowFactory", () => {
  it("creates tasks with correct dependency links when dependsOn is set", async () => {
    const yamlPath = writeYaml(`
name: "dep_workflow"
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
      "client-dep",
      JSON.stringify({})
    );

    const taskRepo = AppDataSource.getRepository(Task);
    const tasks = await taskRepo.find({
      where: { workflow: { workflowId: workflow.workflowId } },
      relations: { dependency: true },
      order: { stepNumber: "ASC" }
    });

    expect(tasks).toHaveLength(2);
    expect(tasks[0].dependencyTaskId).toBeNull();
    expect(tasks[1].dependencyTaskId).toBe(tasks[0].taskId);
    expect(tasks[1].dependency?.taskId).toBe(tasks[0].taskId);
  });

  it("leaves dependency null when no dependsOn is specified", async () => {
    const yamlPath = writeYaml(`
name: "no_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 2
`);
    const factory = new WorkflowFactory(AppDataSource);
    const workflow = await factory.createWorkflowFromYAML(
      yamlPath,
      "client-no-dep",
      JSON.stringify({})
    );

    const taskRepo = AppDataSource.getRepository(Task);
    const tasks = await taskRepo.find({
      where: { workflow: { workflowId: workflow.workflowId } },
      order: { stepNumber: "ASC" }
    });

    expect(tasks.every(t => t.dependencyTaskId == null)).toBe(true);
  });

  it("throws when a step depends on an equal stepNumber", async () => {
    const yamlPath = writeYaml(`
name: "self_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
    dependsOn: 1
`);
    const factory = new WorkflowFactory(AppDataSource);
    await expect(
      factory.createWorkflowFromYAML(yamlPath, "client-self-dep", JSON.stringify({}))
    ).rejects.toThrow("cannot depend on");
  });

  it("throws when a step depends on a later stepNumber", async () => {
    const yamlPath = writeYaml(`
name: "forward_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
    dependsOn: 2
  - taskType: "notification"
    stepNumber: 2
`);
    const factory = new WorkflowFactory(AppDataSource);
    await expect(
      factory.createWorkflowFromYAML(yamlPath, "client-forward-dep", JSON.stringify({}))
    ).rejects.toThrow("cannot depend on");
  });

  it("throws when dependsOn references a stepNumber that does not exist", async () => {
    // Step 3 depends on step 2, but step 2 does not exist
    const yamlPath = writeYaml(`
name: "unknown_dep_workflow"
steps:
  - taskType: "analysis"
    stepNumber: 1
  - taskType: "notification"
    stepNumber: 3
    dependsOn: 2
`);
    const factory = new WorkflowFactory(AppDataSource);
    await expect(
      factory.createWorkflowFromYAML(yamlPath, "client-unknown-dep", JSON.stringify({}))
    ).rejects.toThrow("unknown dependsOn stepNumber");
  });
});
