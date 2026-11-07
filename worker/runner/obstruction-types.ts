import type { Locator } from "playwright";
import type { ObstructionKind } from "@shared/obstructions";
import type { LogLevel } from "./types";

export type Log = (level: LogLevel, message: string, stepId?: string) => Promise<void>;

export type ObstructionOptions = {
  allowContinue?: boolean;
  allowAcceptConsent?: boolean;
};

export type ObstructionResult = {
  dismissed: boolean;
  challenge?: string;
};

export type Overlay = {
  locator: Locator;
  kind: ObstructionKind;
};

export type Control = { locator: Locator; label: string };