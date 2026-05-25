import "reflect-metadata";
import http from "http";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupExpressTestApp } from "../../helpers/app";
import { AppDataSource } from "../../../src/data-source";
import { Workflow } from "../../../src/models/Workflow";
import { WorkflowStatus } from "../../../src/workflows/WorkflowFactory";
import { TaskStatus } from "../../../src/types/TaskStatus";
import { VALID_GEO_JSON } from "../../helpers/utils";

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

  it("returns 202 with a workflowId", async () => {
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

  it("persists workflow with all tasks queued", async () => {
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
    // report_workflow.yml defines 3 steps: analysis + notification + report
    expect(workflow!.tasks).toHaveLength(3);
    expect(workflow!.tasks.every(t => t.status === TaskStatus.Queued)).toBe(true);
  });
});
