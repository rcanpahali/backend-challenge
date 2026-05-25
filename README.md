# Backend Coding Challenge

> **Implementation PR with inline comments:** [github.com/rcanpahali/backend-challenge/pull/1](https://github.com/rcanpahali/backend-challenge/pull/1)

## How to Test

Follow these steps in order to verify all six challenge tasks are working.

---

### Step 1 — Install and Start the App

```bash
npm install
npm start
```

Sometimes, after switching Node.js versions on codesandbox run `npm rebuild better-sqlite3` if the app fails to start and re-run `npm install`.

**You will see:** `Server is running at http://localhost:3000`

The server starts and a background worker begins polling for tasks every 5 seconds.

---

### Step 2 — Create a Workflow

Run the command below to kick off a workflow. This single request triggers all of the underlying work: polygon area calculation (Task 1), report generation (Task 2), interdependent task chaining (Task 3), and final result aggregation (Task 4).

```bash
curl -s -X POST http://localhost:3000/analysis \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "reviewer",
    "geoJson": {
      "type": "Polygon",
      "coordinates": [[
        [-63.624885020050996, -10.311050368263523],
        [-63.624885020050996, -10.367865108370523],
        [-63.61278302732815,  -10.367865108370523],
        [-63.61278302732815,  -10.311050368263523],
        [-63.624885020050996, -10.311050368263523]
      ]]
    }
  }'
```

**You will see:**

```json
{
  "workflowId": "abc12345-...",
  "message": "Workflow created and tasks queued from YAML definition."
}
```

Copy the `workflowId` value — you will need it in the next steps. Replace `<workflowId>` below with your actual value.

---

### Step 3 — Check Workflow Status (Task 5)

```bash
curl -s http://localhost:3000/workflow/<workflowId>/status
```

**You will see** (right after creating the workflow):

```json
{
  "workflowId": "<workflowId>",
  "status": "initial",
  "completedTasks": 0,
  "totalTasks": 3
}
```

The workflow has 3 tasks. They run one after another because each task depends on the previous one finishing first (Task 3 — interdependent tasks).

---

### Step 4 — Wait for the Workflow to Finish

The background worker picks up one task every ~5 seconds. With 3 sequential tasks, **wait about 30 seconds**, then run the status check again:

```bash
curl -s http://localhost:3000/workflow/<workflowId>/status
```

**You will see:**

```json
{
  "workflowId": "<workflowId>",
  "status": "completed",
  "completedTasks": 3,
  "totalTasks": 3
}
```

---

### Step 5 — Get Final Results (Task 6)

Once the workflow is `completed`, retrieve the aggregated results:

```bash
curl -s http://localhost:3000/workflow/<workflowId>/results
```

**You will see:**

```json
{
  "workflowId": "<workflowId>",
  "status": "completed",
  "finalResult": {
    "workflowId": "<workflowId>",
    "tasks": [
      { "taskId": "...", "taskType": "analysis",     "stepNumber": 1, "status": "completed", "output": { ... } },
      { "taskId": "...", "taskType": "notification", "stepNumber": 2, "status": "completed", "output": { ... } },
      { "taskId": "...", "taskType": "report",       "stepNumber": 3, "status": "completed", "output": { ... } }
    ]
  }
}
```

The `finalResult` contains every task's output in one place (Task 4 — final result aggregation). The `report` task (Task 2 — ReportGenerationJob) summarises the outputs of all preceding tasks.

---

### Step 6 — Verify Error Handling

**404 — Workflow not found:**

```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/workflow/00000000-0000-0000-0000-000000000000/status
# prints: 404
```

**400 — Results requested before the workflow completes:**  
If you call `/results` while status is still `initial` or `in_progress`, you get a `400` response with `"Workflow is not yet completed"`.

---

### Step 7 — Run the Full Test Suite

The unit and integration tests cover all six tasks, including isolated tests for `PolygonAreaJob` (Task 1) and `ReportGenerationJob` (Task 2):

```bash
npm test
```

**You will see:** all tests listed and passing with no failures.

---

### Verification Summary

| Step                                     | What was tested                                            | Expected result                              |
| ---------------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `npm start`                              | Server starts                                              | `Server is running at http://localhost:3000` |
| `POST /analysis`                         | Workflow and 3 tasks created                               | `202` with `workflowId`                      |
| `GET /workflow/:id/status` (immediately) | Task 5 — status endpoint                                   | `initial`, 0/3 completed                     |
| `GET /workflow/:id/status` (after ~30s)  | Tasks 3 & 5 — sequential execution + status                | `completed`, 3/3 completed                   |
| `GET /workflow/:id/results`              | Tasks 2, 4 & 6 — report job, finalResult, results endpoint | `200` with full `finalResult`                |
| `GET /status` with unknown ID            | Task 5 — 404 handling                                      | `404`                                        |
| `GET /results` with unknown ID           | Task 6 — 404 handling                                      | `404`                                        |
| `GET /results` before completion         | Task 6 — 400 handling                                      | `400 - Workflow is not yet completed`        |
| `npm test`                               | All tasks including Task 1 (PolygonAreaJob)                | 25/25 tests pass                             |
