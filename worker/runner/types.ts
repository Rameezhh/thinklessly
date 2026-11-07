import type { Page } from "playwright";
import type { AutomationDefinition, Settings } from "@shared/definition";
import type { OutputMeta } from "@shared/normalize";
import type { NetworkCollector } from "../network/collector";

export type RunStatus = "SUCCESS" | "FAILED" | "NEEDS_HUMAN" | "CANCELLED";
export type LogLevel = "info" | "warn" | "error";

export type LogEntry = {
  level: LogLevel;
  message: string;
  stepId?: string;
};

export type LogFn = (entry: LogEntry) => void | Promise<void>;

export type RunArtifactInfo = {
  kind: "SCREENSHOT" | "FILE";
  path: string;
  name: string;
};

export type RunResult = {
  status: RunStatus;
  outputs: Record<string, unknown>;
  meta: Record<string, OutputMeta>;
  error?: string;
  failedStepId?: string;
  message?: string;
  artifacts: RunArtifactInfo[];
};

export type RunOptions = {
  definition: AutomationDefinition;
  inputs: Record<string, unknown>;
  secrets: Record<string, string>;
  runDir: string;
  onLog?: LogFn;
  headless?: boolean;
  profileKey?: string;
  shouldCancel?: () => boolean | Promise<boolean>;
};

export type StepContext = {
  page: Page;
  definition: AutomationDefinition;
  settings: Settings;
  inputs: Record<string, unknown>;
  secrets: Record<string, string>;
  outputs: Record<string, unknown>;
  meta: Record<string, OutputMeta>;
  artifacts: RunArtifactInfo[];
  runDir: string;
  timeout: number;
  network?: NetworkCollector;
  networkCursor?: number;
  log: (level: LogLevel, message: string, stepId?: string) => Promise<void>;
};
