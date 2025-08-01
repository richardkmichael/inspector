import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "node:fs";
import { dirname } from "node:path";

/**
 * Debug log entry structure for JSONL output
 */
interface DebugLogEntry {
  hrtime: string;
  time: string;
  pid: number;
  role: string;
  direction: string;
  message?: JSONRPCMessage;
  error?: string;
}

/**
 * Simple debug logger for proxy traffic
 */
export class DebugLogger {
  private logFileHandle: fs.FileHandle | null = null;
  private logFilePath: string;
  private role: string;

  constructor(debugBasePath: string, role: string = "proxy") {
    this.role = role;
    this.logFilePath = `${debugBasePath}.${role}.${process.pid}`;
  }

  async initialize(): Promise<void> {
    try {
      // Ensure parent directory exists if path contains directories
      const parentDir = dirname(this.logFilePath);
      if (parentDir !== ".") {
        await fs.mkdir(parentDir, { recursive: true });
      }

      // Open file for appending
      this.logFileHandle = await fs.open(this.logFilePath, "a");
    } catch (error) {
      console.error(
        `[DebugLogger] Failed to open log file ${this.logFilePath}:`,
        error,
      );
      // Continue without logging rather than failing
    }
  }

  async logMessage(direction: string, message: JSONRPCMessage): Promise<void> {
    if (!this.logFileHandle) {
      return;
    }

    const entry: DebugLogEntry = {
      hrtime: process.hrtime.bigint().toString(),
      time: new Date().toISOString(),
      pid: process.pid,
      role: this.role,
      direction,
      message,
    };

    try {
      const line = JSON.stringify(entry) + "\n";
      await this.logFileHandle.write(line);
      if (this.logFileHandle) {
        await this.logFileHandle.sync(); // Ensure data is written to disk
      }
    } catch (error) {
      console.error("[DebugLogger] Failed to write log entry:", error);
    }
  }

  async logError(error: Error): Promise<void> {
    if (!this.logFileHandle) {
      return;
    }

    const entry: DebugLogEntry = {
      hrtime: process.hrtime.bigint().toString(),
      time: new Date().toISOString(),
      pid: process.pid,
      role: this.role,
      direction: "error",
      error: error.message,
    };

    try {
      const line = JSON.stringify(entry) + "\n";
      await this.logFileHandle.write(line);
    } catch {
      // Ignore logging errors for error logging
    }
  }

  async logClose(): Promise<void> {
    if (!this.logFileHandle) {
      return;
    }

    const entry: DebugLogEntry = {
      hrtime: process.hrtime.bigint().toString(),
      time: new Date().toISOString(),
      pid: process.pid,
      role: this.role,
      direction: "close",
    };

    try {
      const line = JSON.stringify(entry) + "\n";
      await this.logFileHandle.write(line);
      await this.logFileHandle.close();
      this.logFileHandle = null;
    } catch {
      // Ignore cleanup errors
    }
  }
}
