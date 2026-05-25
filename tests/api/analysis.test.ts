import "reflect-metadata";
import http from "http";
import path from "path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupExpressTestApp } from "../../src/test/app";
import { AppDataSource } from "../../src/data-source";
import { Workflow } from "../../src/models/Workflow";
import { Task } from "../../src/models/Task";
import { WorkflowStatus, WorkflowFactory } from "../../src/workflows/WorkflowFactory";
import { createTaskRunner } from "../../src/workers/taskRunner";
import { TaskStatus } from "../../src/types/TaskStatus";
import { Result } from "../../src/models/Result";
import { VALID_GEO_JSON } from "./utils";

describe("POST /analysis", () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(() => {
    const app = setupExpressTestApp();
    server = app.listen(0); // 0 = random available port
    const addr = server.address() as { port: number };
    baseUrl = `http://localhost:${addr.port}`;
  });

  afterAll(() => {
    server.close();
  });

  it("returns 202 with a workflowId on a valid payload", async () => {
    const res = await fetch(`${baseUrl}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "client-happy-path", geoJson: VALID_GEO_JSON })
    });

    expect(res.status).toBe(202);

    const body = (await res.json()) as { workflowId: string; message: string };
    expect(typeof body.workflowId).toBe("string");
    expect(body.workflowId.length).toBeGreaterThan(0);
    expect(body.message).toBeDefined();
  });

  it("returns 400 when clientId is missing", async () => {
    const res = await fetch(`${baseUrl}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ geoJson: VALID_GEO_JSON })
    });

    expect(res.status).toBe(400);
  });

  it("persists the workflow and tasks with the correct initial statuses", async () => {
    const res = await fetch(`${baseUrl}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "client-db-check", geoJson: VALID_GEO_JSON })
    });

    expect(res.status).toBe(202);
    const { workflowId } = (await res.json()) as { workflowId: string };

    const workflowRepo = AppDataSource.getRepository(Workflow);
    const workflow = await workflowRepo.findOne({
      where: { workflowId },
      relations: { tasks: true }
    });

    expect(workflow).not.toBeNull();
    expect(workflow!.status).toBe(WorkflowStatus.Initial);
    // multi_task_workflow.yml defines 2 steps: analysis + notification
    expect(workflow!.tasks).toHaveLength(2);
    expect(workflow!.tasks.every(t => t.status === TaskStatus.Queued)).toBe(true);
  });
});

describe("TaskRunner", () => {
  it("runs all tasks and marks the workflow completed", async () => {
    const factory = new WorkflowFactory(AppDataSource);
    const workflowYaml = path.join(__dirname, "../../src/workflows/multi_task_workflow.yml");

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

    // Workflow should now be completed
    const workflowRepo = AppDataSource.getRepository(Workflow);
    const finalWorkflow = await workflowRepo.findOne({
      where: { workflowId: workflow.workflowId },
      relations: { tasks: true }
    });

    expect(finalWorkflow!.status).toBe(WorkflowStatus.Completed);
    expect(finalWorkflow!.tasks.every(t => t.status === TaskStatus.Completed)).toBe(true);
  });
});
