import {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { DebugLogger } from "./debug-logger.js";

/**
 * A transport wrapper that adds debug logging to any transport implementation
 */
export class DebugTransportWrapper implements Transport {
  private debugLogger: DebugLogger;
  private initialized = false;

  constructor(
    private wrappedTransport: Transport,
    private role: string,
    debugBasePath: string,
  ) {
    this.debugLogger = new DebugLogger(debugBasePath, role);
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

    // Wrap the callbacks
    const originalOnMessage = this.wrappedTransport.onmessage;
    const originalOnError = this.wrappedTransport.onerror;
    const originalOnClose = this.wrappedTransport.onclose;

    this.wrappedTransport.onmessage = (message, extra) => {
      this.debugLogger.logMessage("recv", message);
      if (originalOnMessage) {
        originalOnMessage(message, extra);
      }
    };

    this.wrappedTransport.onerror = (error) => {
      this.debugLogger.logError(error);
      if (originalOnError) {
        originalOnError(error);
      }
    };

    this.wrappedTransport.onclose = () => {
      this.debugLogger.logClose();
      if (originalOnClose) {
        originalOnClose();
      }
    };

    await this.wrappedTransport.start();
  }

  async send(
    message: JSONRPCMessage,
    options?: TransportSendOptions,
  ): Promise<void> {
    await this.ensureInitialized();
    await this.debugLogger.logMessage("send", message);
    await this.wrappedTransport.send(message, options);
  }

  async close(): Promise<void> {
    await this.debugLogger.logClose();
    await this.wrappedTransport.close();
  }

  // Delegate callback setters
  set onclose(callback: (() => void) | undefined) {
    // We'll handle this in start() to wrap it
    this._onclose = callback;
  }

  get onclose(): (() => void) | undefined {
    return this._onclose;
  }

  set onerror(callback: ((error: Error) => void) | undefined) {
    // We'll handle this in start() to wrap it
    this._onerror = callback;
  }

  get onerror(): ((error: Error) => void) | undefined {
    return this._onerror;
  }

  set onmessage(
    callback: ((message: JSONRPCMessage, extra?: any) => void) | undefined,
  ) {
    // We'll handle this in start() to wrap it
    this._onmessage = callback;
  }

  get onmessage():
    | ((message: JSONRPCMessage, extra?: any) => void)
    | undefined {
    return this._onmessage;
  }

  // Store the original callbacks
  private _onclose?: (() => void) | undefined;
  private _onerror?: ((error: Error) => void) | undefined;
  private _onmessage?:
    | ((message: JSONRPCMessage, extra?: any) => void)
    | undefined;

  // Delegate any other methods
  setProtocolVersion?(version: string): void {
    if ("setProtocolVersion" in this.wrappedTransport) {
      (this.wrappedTransport as any).setProtocolVersion(version);
    }
  }
}

/**
 * Convenience function to wrap a transport with debug logging if enabled
 */
export function wrapWithDebugLogging(
  transport: Transport,
  role: string,
): Transport {
  const debugBasePath = process.env.MCP_TRANSPORT_DEBUG_FILE;
  if (debugBasePath) {
    return new DebugTransportWrapper(transport, role, debugBasePath);
  }
  return transport;
}
