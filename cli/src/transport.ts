import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { findActualExecutable } from "spawn-rx";
import { DebugLogger } from "./debug-logger.js";

export type TransportOptions = {
  transportType: "sse" | "stdio" | "http";
  command?: string;
  args?: string[];
  url?: string;
};

function createSSETransport(options: TransportOptions): Transport {
  const baseUrl = new URL(options.url ?? "");
  const sseUrl = baseUrl.pathname.endsWith("/sse")
    ? baseUrl
    : new URL("/sse", baseUrl);

  return new SSEClientTransport(sseUrl);
}

function createHTTPTransport(options: TransportOptions): Transport {
  const baseUrl = new URL(options.url ?? "");
  const mcpUrl = baseUrl.pathname.endsWith("/mcp")
    ? baseUrl
    : new URL("/mcp", baseUrl);

  return new StreamableHTTPClientTransport(mcpUrl);
}

function createStdioTransport(options: TransportOptions): Transport {
  let args: string[] = [];

  if (options.args !== undefined) {
    args = options.args;
  }

  const processEnv: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      processEnv[key] = value;
    }
  }

  const defaultEnv = getDefaultEnvironment();

  const env: Record<string, string> = {
    ...processEnv,
    ...defaultEnv,
  };

  const { cmd: actualCommand, args: actualArgs } = findActualExecutable(
    options.command ?? "",
    args,
  );

  return new StdioClientTransport({
    command: actualCommand,
    args: actualArgs,
    env,
    stderr: "pipe",
  });
}

/**
 * Debug transport wrapper that intercepts all transport operations
 */
class DebugTransportWrapper implements Transport {
  private debugLogger: DebugLogger;
  private initialized = false;

  constructor(
    private wrappedTransport: Transport,
    debugBasePath: string,
  ) {
    this.debugLogger = new DebugLogger(debugBasePath, "cli");
  }

  get sessionId(): string | undefined {
    return this.wrappedTransport.sessionId;
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.debugLogger.initialize();
      this.initialized = true;
    }
  }

  async start(): Promise<void> {
    await this.ensureInitialized();
    return this.wrappedTransport.start();
  }

  async send(message: JSONRPCMessage, options?: any): Promise<void> {
    await this.ensureInitialized();
    await this.debugLogger.logMessage("send", message);
    return this.wrappedTransport.send(message, options);
  }

  async close(): Promise<void> {
    await this.debugLogger.logClose();
    return this.wrappedTransport.close();
  }

  // Callback delegation with debug wrapping
  set onmessage(
    callback: ((message: JSONRPCMessage, extra?: any) => void) | undefined,
  ) {
    this.wrappedTransport.onmessage = callback
      ? async (message, extra) => {
          await this.ensureInitialized();
          await this.debugLogger.logMessage("recv", message);
          callback(message, extra);
        }
      : undefined;
  }

  get onmessage():
    | ((message: JSONRPCMessage, extra?: any) => void)
    | undefined {
    return this.wrappedTransport.onmessage;
  }

  set onerror(callback: ((error: Error) => void) | undefined) {
    this.wrappedTransport.onerror = callback
      ? async (error) => {
          await this.ensureInitialized();
          await this.debugLogger.logError(error);
          callback(error);
        }
      : undefined;
  }

  get onerror(): ((error: Error) => void) | undefined {
    return this.wrappedTransport.onerror;
  }

  set onclose(callback: (() => void) | undefined) {
    this.wrappedTransport.onclose = callback
      ? async () => {
          await this.debugLogger.logClose();
          callback();
        }
      : undefined;
  }

  get onclose(): (() => void) | undefined {
    return this.wrappedTransport.onclose;
  }

  // Delegate any additional methods
  setProtocolVersion?(version: string): void {
    if ("setProtocolVersion" in this.wrappedTransport) {
      (this.wrappedTransport as any).setProtocolVersion(version);
    }
  }
}

/**
 * Wraps a transport with debug logging
 */
function wrapTransportWithDebugLogging(
  transport: Transport,
  debugBasePath: string,
): Transport {
  return new DebugTransportWrapper(transport, debugBasePath);
}

export function createTransport(options: TransportOptions): Transport {
  const { transportType } = options;

  try {
    let transport: Transport;

    if (transportType === "stdio") {
      transport = createStdioTransport(options);
    } else if (transportType === "sse") {
      transport = createSSETransport(options);
    } else if (transportType === "http") {
      transport = createHTTPTransport(options);
    } else {
      throw new Error(`Unsupported transport type: ${transportType}`);
    }

    // Wrap with debug logging if enabled
    const debugBasePath = process.env.MCP_TRANSPORT_DEBUG_FILE;
    if (debugBasePath) {
      transport = wrapTransportWithDebugLogging(transport, debugBasePath);
    }

    return transport;
  } catch (error) {
    throw new Error(
      `Failed to create transport: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
