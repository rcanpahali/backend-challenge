import "reflect-metadata";
import http from "http";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupExpressTestApp } from "../../helpers/app";
import { AppDataSource } from "../../../src/data-source";
import { Workflow } from "../../../src/models/Workflow";
import { WorkflowStatus } from "../../../src/workflows/WorkflowFactory";
import { VALID_GEO_JSON } from "../../helpers/utils";

let server: http.Server;
let baseUrl: string;

beforeAll(() => {
  const app = setupExpressTestApp();
  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as { port: number }).port}`;
});

afterAll(() => {
  server.close();
});

async function createWorkflow(status: WorkflowStatus, finalResult?: string): Promise<Workflow> {
  const repo = AppDataSource.getRepository(Workflow);
  return repo.save(repo.create({ clientId: "test-client", status, tasks: [], finalResult }));
}

describe("GET /workflow/:id/status", () => {
  it("returns 404 for an unknown workflow", async () => {
    const res = await fetch(`${baseUrl}/workflow/00000000-0000-0000-0000-000000000000/status`);
    expect(res.status).toBe(404);
  });

  it("returns status and task counts for a new workflow", async () => {
    const createRes = await fetch(`${baseUrl}/analysis`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: "client-status-check", geoJson: VALID_GEO_JSON })
    });
    expect(createRes.status).toBe(202);
    const { workflowId } = (await createRes.json()) as { workflowId: string };

    const res = await fetch(`${baseUrl}/workflow/${workflowId}/status`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as {
      workflowId: string;
      status: string;
      completedTasks: number;
      totalTasks: number;
    };

    expect(body.workflowId).toBe(workflowId);
    expect(body.status).toBe(WorkflowStatus.Initial);
    expect(body.completedTasks).toBe(0);
    expect(body.totalTasks).toBeGreaterThan(0);
  });
});

describe("GET /workflow/:id/results", () => {
  it("returns 404 for an unknown workflow", async () => {
    const res = await fetch(`${baseUrl}/workflow/00000000-0000-0000-0000-000000000000/results`);
    expect(res.status).toBe(404);
  });

  it("returns 400 when workflow is not complete", async () => {
    const workflow = await createWorkflow(WorkflowStatus.Initial);
    const res = await fetch(`${baseUrl}/workflow/${workflow.workflowId}/results`);
    expect(res.status).toBe(400);
  });

  it("returns finalResult for a completed workflow", async () => {
    const workflow = await createWorkflow(
      WorkflowStatus.Completed,
      JSON.stringify({ summary: "done" })
    );

    const res = await fetch(`${baseUrl}/workflow/${workflow.workflowId}/results`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { workflowId: string; status: string; finalResult: unknown };
    expect(body.workflowId).toBe(workflow.workflowId);
    expect(body.status).toBe(WorkflowStatus.Completed);
    expect(body.finalResult).toEqual({ summary: "done" });
  });

  it("returns finalResult for a failed workflow", async () => {
    const workflow = await createWorkflow(
      WorkflowStatus.Failed,
      JSON.stringify({ summary: "failed" })
    );

    const res = await fetch(`${baseUrl}/workflow/${workflow.workflowId}/results`);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { workflowId: string; status: string; finalResult: unknown };
    expect(body.workflowId).toBe(workflow.workflowId);
    expect(body.status).toBe(WorkflowStatus.Failed);
    expect(body.finalResult).toEqual({ summary: "failed" });
  });
});
