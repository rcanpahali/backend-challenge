import { describe, it, expect } from "vitest";
import { PolygonAreaJob } from "../../../src/jobs/PolygonAreaJob";
import { Task } from "../../../src/models/Task";
import { TaskStatus } from "../../../src/workers/taskRunner";

function makeTask(payload: unknown): Task {
  return {
    taskId: "test-task-id",
    clientId: "test-client",
    taskType: "polygon_area",
    status: TaskStatus.Queued,
    stepNumber: 1,
    payload: JSON.stringify(payload)
  } as Task;
}

const VALID_POLYGON = {
  type: "Feature",
  geometry: {
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
  },
  properties: {}
};

describe("PolygonAreaJob", () => {
  const job = new PolygonAreaJob();

  it("returns the area in square meters for a valid polygon", async () => {
    const task = makeTask({ geoJson: VALID_POLYGON });
    const result = await job.run(task);

    expect(result.areaSquareMeters).toBeTypeOf("number");
    expect(result.areaSquareMeters).toBeGreaterThan(0);
  });

  it("throws when geoJson is missing from the payload", () => {
    const task = makeTask({});
    expect(() => job.run(task)).toThrow("Missing geometry in payload");
  });

  it("throws when payload is not valid JSON", () => {
    const task = { ...makeTask({}), payload: "not-json" };
    expect(() => job.run(task)).toThrow("Failed to parse task payload");
  });
});
