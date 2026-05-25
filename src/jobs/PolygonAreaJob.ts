import { Job } from "./Job";
import { Task } from "../models/Task";
import { area } from "@turf/turf";
import { Feature, Polygon, MultiPolygon } from "geojson";
import logger from "../logger";
import { parsePayload } from "./parsePayload";

export class PolygonAreaJob implements Job {
  run(task: Task): Promise<{ areaSquareMeters: number }> {
    logger.info({ taskId: task.taskId }, "Running polygon area calculation");

    const { geoJson } = parsePayload<{ geoJson: Feature<Polygon | MultiPolygon> }>(task);

    if (!geoJson?.geometry) {
      throw new Error("Missing geometry in payload");
    }

    const areaSquareMeters = area(geoJson);
    logger.debug({ taskId: task.taskId, areaSquareMeters }, "Polygon area calculated");

    return Promise.resolve({ areaSquareMeters });
  }
}
