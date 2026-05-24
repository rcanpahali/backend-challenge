# Server Architecture

## Overview

An Express.js backend that accepts geospatial analysis requests and executes them asynchronously through a YAML-driven workflow engine. Tasks are persisted in SQLite and processed by a background polling worker.

---

## System Architecture Diagram

```mermaid
graph TB
    subgraph HTTP["HTTP Layer"]
        CLIENT["HTTP Client"]
        POST["POST /analysis"]
        GET_ROOT["GET /"]
    end

    subgraph APP["Express App (index.ts)"]
        MIDDLEWARE["JSON Middleware"]
        ROUTER["Router"]
    end

    subgraph ROUTES["Routes (src/routes/)"]
        ANALYSIS_ROUTE["analysisRoutes.ts"]
        DEFAULT_ROUTE["defaultRoute.ts"]
    end

    subgraph WORKFLOW["Workflow Layer (src/workflows/)"]
        WF_FACTORY["WorkflowFactory\ncreateWorkflowFromYAML()"]
        YAML["example_workflow.yml\nanalysis → notification"]
    end

    subgraph DB["Database (SQLite)"]
        WORKFLOW_TBL[("Workflow\nworkflowId, clientId, status")]
        TASK_TBL[("Task\ntaskId, taskType, status,\nstepNumber, geoJson, resultId")]
        RESULT_TBL[("Result\nresultId, taskId, data")]
    end

    subgraph WORKER["Background Worker (src/workers/)"]
        TASK_WORKER["taskWorker.ts\npoll every 5s"]
        TASK_RUNNER["TaskRunner.run(task)"]
    end

    subgraph JOBS["Job Registry (src/jobs/)"]
        JOB_FACTORY["JobFactory\ngetJobForTaskType()"]
        ANALYSIS_JOB["DataAnalysisJob\n'analysis'"]
        NOTIFICATION_JOB["EmailNotificationJob\n'notification'"]
    end

    CLIENT -->|"POST /analysis\n{clientId, geoJson}"| POST
    CLIENT -->|"GET /"| GET_ROOT
    POST --> MIDDLEWARE --> ROUTER
    GET_ROOT --> ROUTER
    ROUTER --> ANALYSIS_ROUTE
    ROUTER --> DEFAULT_ROUTE

    ANALYSIS_ROUTE -->|"load YAML + save entities"| WF_FACTORY
    WF_FACTORY --> YAML
    WF_FACTORY -->|"INSERT Workflow (status: initial)"| WORKFLOW_TBL
    WF_FACTORY -->|"INSERT Tasks (status: queued)"| TASK_TBL
    ANALYSIS_ROUTE -->|"202 Accepted\n{workflowId}"| CLIENT

    TASK_WORKER -->|"SELECT WHERE status = queued"| TASK_TBL
    TASK_WORKER --> TASK_RUNNER
    TASK_RUNNER -->|"UPDATE status = in_progress"| TASK_TBL
    TASK_RUNNER --> JOB_FACTORY
    JOB_FACTORY --> ANALYSIS_JOB
    JOB_FACTORY --> NOTIFICATION_JOB
    ANALYSIS_JOB -->|"returns {country}"| TASK_RUNNER
    NOTIFICATION_JOB -->|"returns undefined"| TASK_RUNNER
    TASK_RUNNER -->|"INSERT Result{data}"| RESULT_TBL
    TASK_RUNNER -->|"UPDATE status = completed\nresultId = result.resultId"| TASK_TBL
    TASK_RUNNER -->|"UPDATE workflow status"| WORKFLOW_TBL
```

---

## Request Lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant R as POST /analysis
    participant WF as WorkflowFactory
    participant DB as SQLite
    participant W as taskWorker
    participant TR as TaskRunner
    participant J as Job (analysis/notification)

    C->>R: POST /analysis {clientId, geoJson}
    R->>WF: createWorkflowFromYAML(yml, clientId, geoJson)
    WF->>DB: INSERT Workflow (status: initial)
    WF->>DB: INSERT Task[1] analysis (status: queued)
    WF->>DB: INSERT Task[2] notification (status: queued)
    WF-->>R: Workflow entity
    R-->>C: 202 Accepted {workflowId}

    loop Poll every 5s
        W->>DB: SELECT tasks WHERE status = queued
        DB-->>W: Task[1] analysis
        W->>TR: run(task)
        TR->>DB: UPDATE task status = in_progress
        TR->>J: DataAnalysisJob.run(task)
        J-->>TR: {country: "Brazil"}
        TR->>DB: INSERT Result {data: JSON}
        TR->>DB: UPDATE task status = completed, resultId
        TR->>DB: UPDATE workflow status = in_progress

        W->>DB: SELECT tasks WHERE status = queued
        DB-->>W: Task[2] notification
        W->>TR: run(task)
        TR->>DB: UPDATE task status = in_progress
        TR->>J: EmailNotificationJob.run(task)
        J-->>TR: undefined
        TR->>DB: INSERT Result {data: JSON}
        TR->>DB: UPDATE task status = completed, resultId
        TR->>DB: UPDATE workflow status = completed
    end
```

---

## Entity Relationships

```mermaid
erDiagram
    WORKFLOW {
        uuid workflowId PK
        string clientId
        string status
    }
    TASK {
        uuid taskId PK
        string clientId
        string taskType
        string status
        int stepNumber
        string geoJson
        string resultId FK
        uuid workflowId FK
    }
    RESULT {
        uuid resultId PK
        string taskId
        string data
    }

    WORKFLOW ||--o{ TASK : "has many"
    TASK ||--o| RESULT : "produces"
```

---

## Component Map

| Layer | File | Responsibility |
|---|---|---|
| Entry | [src/index.ts](../src/index.ts) | Bootstraps Express, registers routes, starts worker |
| Config | [src/config.ts](../src/config.ts) | Validates env vars with Zod |
| Database | [src/data-source.ts](../src/data-source.ts) | TypeORM DataSource (SQLite, synchronize: true) |
| Route | [src/routes/analysisRoutes.ts](../src/routes/analysisRoutes.ts) | `POST /analysis` — triggers workflow creation |
| Route | [src/routes/defaultRoute.ts](../src/routes/defaultRoute.ts) | `GET /` — renders README.md as styled HTML |
| Entity | [src/models/Workflow.ts](../src/models/Workflow.ts) | Workflow DB entity (groups tasks) |
| Entity | [src/models/Task.ts](../src/models/Task.ts) | Task DB entity (single unit of work) |
| Entity | [src/models/Result.ts](../src/models/Result.ts) | Result DB entity (stores job output JSON) |
| Workflow | [src/workflows/WorkflowFactory.ts](../src/workflows/WorkflowFactory.ts) | Parses YAML → creates Workflow + Task rows |
| Worker | [src/workers/taskWorker.ts](../src/workers/taskWorker.ts) | Infinite polling loop — picks up queued tasks |
| Worker | [src/workers/taskRunner.ts](../src/workers/taskRunner.ts) | Executes a single task, manages status transitions |
| Job | [src/jobs/JobFactory.ts](../src/jobs/JobFactory.ts) | Maps `taskType` string → `Job` instance |
| Job | [src/jobs/DataAnalysisJob.ts](../src/jobs/DataAnalysisJob.ts) | Geospatial containment check via Turf.js |
| Job | [src/jobs/EmailNotificationJob.ts](../src/jobs/EmailNotificationJob.ts) | Simulated email notification (500ms delay) |

---

## Status State Machines

### Task Status

```mermaid
stateDiagram-v2
    [*] --> queued: task created
    queued --> in_progress: worker picks up task
    in_progress --> completed: job.run() succeeds
    in_progress --> failed: job.run() throws
```

### Workflow Status

```mermaid
stateDiagram-v2
    [*] --> initial: workflow created
    initial --> in_progress: first task completes
    in_progress --> completed: all tasks completed
    in_progress --> failed: any task fails
```

---

## Adding a New Job

1. Create `src/jobs/MyJob.ts` implementing the `Job` interface
2. Register it in `src/jobs/JobFactory.ts` under a new `taskType` key
3. Reference the `taskType` in a YAML workflow definition
