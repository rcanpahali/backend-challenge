import { Job } from "./Job";
import { Task } from "../models/Task";
import booleanWithin from "@turf/boolean-within";
import { Feature, Polygon } from "geojson";
import countryMapping from "../data/world_data.json";
import logger from "../logger";
import { parsePayload } from "./parsePayload";

export class DataAnalysisJob implements Job {
  run(task: Task): Promise<string> {
    logger.info({ taskId: task.taskId }, "Running data analysis");

    const { geoJson } = parsePayload<{ geoJson: Feature<Polygon> }>(task);
    const inputGeometry = geoJson;

    for (const countryFeature of countryMapping.features) {
      if (
        countryFeature.geometry.type === "Polygon" ||
        countryFeature.geometry.type === "MultiPolygon"
      ) {
        const isWithin = booleanWithin(inputGeometry, countryFeature as Feature<Polygon>);
        if (isWithin) {
          logger.debug(
            { taskId: task.taskId, country: countryFeature.properties?.name },
            "Polygon matched country"
          );
          return Promise.resolve(countryFeature.properties?.name ?? "No country found");
        }
      }
    }
    return Promise.resolve("No country found");
  }
}
