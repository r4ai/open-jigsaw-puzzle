import { readFileSync } from "node:fs";
import { requiredEnv, writeGithubOutput } from "./workflow-helpers.ts";

type WorkflowRunPullRequest = {
  number?: number;
};

type WorkflowRunEvent = {
  workflow_run?: {
    head_repository?: {
      full_name?: string;
    };
    head_sha?: string;
    pull_requests?: WorkflowRunPullRequest[];
  };
};

const event = JSON.parse(readFileSync(requiredEnv("GITHUB_EVENT_PATH"), "utf8")) as WorkflowRunEvent;
const repository = requiredEnv("GITHUB_REPOSITORY");
const workflowRun = event.workflow_run;

if (!workflowRun) throw new Error("This script must run from a workflow_run event.");
if (workflowRun.head_repository?.full_name !== repository) {
  throw new Error("Preview deploys are allowed only for pull requests from this repository.");
}

const pullRequests = workflowRun.pull_requests ?? [];
if (pullRequests.length !== 1) {
  throw new Error(`Expected exactly one pull request for this workflow run, found ${pullRequests.length}.`);
}

const prNumber = pullRequests[0]?.number;
if (!Number.isInteger(prNumber)) throw new Error("Unable to determine pull request number.");
if (!workflowRun.head_sha) throw new Error("Unable to determine workflow run commit SHA.");

writeGithubOutput("pr_number", String(prNumber));
writeGithubOutput("commit_sha", workflowRun.head_sha);
