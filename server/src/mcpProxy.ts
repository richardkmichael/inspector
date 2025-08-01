import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { isJSONRPCRequest } from "@modelcontextprotocol/sdk/types.js";
import { DebugLogger } from "./debug-logger.js";

function onClientError(error: Error) {
  console.error("Error from inspector client:", error);
}

function onServerError(error: Error) {
  if (
    (error?.message &&
      error.message.includes("Error POSTing to endpoint (HTTP 404)")) ||
    (error?.cause && JSON.stringify(error.cause).includes("ECONNREFUSED"))
  ) {
    console.error("Connection refused. Is the MCP server running?");
  } else {
    console.error("Error from MCP server:", error);
  }
}

export default function mcpProxy({
  transportToClient,
  transportToServer,
}: {
  transportToClient: Transport;
  transportToServer: Transport;
}) {
  let transportToClientClosed = false;
  let transportToServerClosed = false;

  let reportedServerSession = false;

  // Initialize debug logging if environment variable is set
  let debugLogger: DebugLogger | null = null;
  const debugBasePath = process.env.MCP_TRANSPORT_DEBUG_FILE;
  if (debugBasePath) {
    debugLogger = new DebugLogger(debugBasePath);
    debugLogger.initialize().catch((error) => {
      console.error("[mcpProxy] Failed to initialize debug logger:", error);
    });
  }

  transportToClient.onmessage = (message) => {
    // Log message from client to server
    debugLogger?.logMessage("client->server", message);

    transportToServer.send(message).catch((error) => {
      debugLogger?.logError(error);

      // Send error response back to client if it was a request (has id) and connection is still open
      if (isJSONRPCRequest(message) && !transportToClientClosed) {
        const errorResponse = {
          jsonrpc: "2.0" as const,
          id: message.id,
          error: {
            code: -32001,
            message: error.message,
            data: error,
          },
        };
        transportToClient.send(errorResponse).catch(onClientError);
      }
    });
  };

  transportToServer.onmessage = (message) => {
    if (!reportedServerSession) {
      if (transportToServer.sessionId) {
        // Can only report for StreamableHttp
        console.error(
          "Proxy  <-> Server sessionId: " + transportToServer.sessionId,
        );
      }
      reportedServerSession = true;
    }

    // Log message from server to client
    debugLogger?.logMessage("server->client", message);

    transportToClient.send(message).catch(onClientError);
  };

  transportToClient.onclose = () => {
    if (transportToServerClosed) {
      return;
    }

    transportToClientClosed = true;
    debugLogger?.logClose();
    transportToServer.close().catch(onServerError);
  };

  transportToServer.onclose = () => {
    if (transportToClientClosed) {
      return;
    }
    transportToServerClosed = true;
    debugLogger?.logClose();
    transportToClient.close().catch(onClientError);
  };

  transportToClient.onerror = (error) => {
    debugLogger?.logError(error);
    onClientError(error);
  };

  transportToServer.onerror = (error) => {
    debugLogger?.logError(error);
    onServerError(error);
  };
}
