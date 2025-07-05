import { render, waitFor } from "@testing-library/react";
import App from "../App";
import { useConnection } from "../lib/hooks/useConnection";

// Mock auth dependencies first
jest.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
  auth: jest.fn(),
}));

jest.mock("../lib/oauth-state-machine", () => ({
  OAuthStateMachine: jest.fn(),
}));

jest.mock("../lib/auth", () => ({
  InspectorOAuthClientProvider: jest.fn().mockImplementation(() => ({
    tokens: jest.fn().mockResolvedValue(null),
    clear: jest.fn(),
  })),
  DebugInspectorOAuthClientProvider: jest.fn(),
}));

// Mock the config utils
jest.mock("../utils/configUtils", () => ({
  ...jest.requireActual("../utils/configUtils"),
  getMCPProxyAddress: jest.fn(() => "http://localhost:6277"),
  getMCPProxyAuthToken: jest.fn(() => ({
    token: "",
    header: "X-MCP-Proxy-Auth",
  })),
  getInitialTransportType: jest.fn(() => "stdio"),
  getInitialSseUrl: jest.fn(() => "http://localhost:3001/sse"),
  getInitialCommand: jest.fn(() => "mcp-server-everything"),
  getInitialArgs: jest.fn(() => ""),
  initializeInspectorConfig: jest.fn(() => ({})),
  saveInspectorConfig: jest.fn(),
}));

// Mock other dependencies
jest.mock("../lib/hooks/useConnection", () => ({
  useConnection: jest.fn(() => ({
    connectionStatus: "connected",
    serverCapabilities: { resources: true },
    mcpClient: {},
    requestHistory: [],
    makeRequest: jest.fn(),
    sendNotification: jest.fn(),
    handleCompletion: jest.fn(),
    completionsSupported: false,
    connect: jest.fn(),
    disconnect: jest.fn(),
  })),
}));
jest.mock("../lib/hooks/useDraggablePane", () => ({
  useDraggablePane: () => ({
    height: 300,
    handleDragStart: jest.fn(),
  }),
  useDraggableSidebar: () => ({
    width: 320,
    isDragging: false,
    handleDragStart: jest.fn(),
  }),
}));

jest.mock("../components/Sidebar", () => ({
  __esModule: true,
  default: () => <div>Sidebar</div>,
}));

global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

// Mock window.location and window.history
const mockLocation = { hash: "", pathname: "/", search: "" };
const mockHistory = { replaceState: jest.fn() };
Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});
Object.defineProperty(window, "history", {
  value: mockHistory,
  writable: true,
});

describe("App - URL Fragment Routing", () => {
  const mockUseConnection = jest.mocked(useConnection);

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.hash = "";
  });

  test("sets default hash based on server capabilities priority", async () => {
    const testCases = [
      {
        capabilities: { resources: { listChanged: true, subscribe: true } },
        expected: "resources",
      },
      {
        capabilities: { prompts: { listChanged: true, subscribe: true } },
        expected: "prompts",
      },
      {
        capabilities: { tools: { listChanged: true, subscribe: true } },
        expected: "tools",
      },
      { capabilities: {}, expected: "ping" }, // No server capabilities - falls back to Ping
    ];

    for (const { capabilities, expected } of testCases) {
      mockLocation.hash = "";
      mockUseConnection.mockImplementationOnce(() => ({
        ...mockUseConnection(),
        serverCapabilities: capabilities,
      }));

      render(<App />);

      await waitFor(() => {
        expect(mockLocation.hash).toBe(expected);
      });
    }
  });

  test("does not set hash when disconnected", async () => {
    mockLocation.hash = "";
    mockUseConnection.mockImplementationOnce(() => ({
      ...mockUseConnection(),
      connectionStatus: "disconnected",
      serverCapabilities: null,
      mcpClient: null,
    }));

    render(<App />);

    await waitFor(() => {
      expect(mockLocation.hash).toBe("");
    });
  });

  test("clears hash when disconnected", async () => {
    mockLocation.hash = "";

    // Start connected - use default connected state
    const { rerender } = render(<App />);

    // Should set hash to resources (from default mock)
    await waitFor(() => {
      expect(mockLocation.hash).toBe("resources");
    });

    // Now disconnect
    mockUseConnection.mockImplementationOnce(() => ({
      ...mockUseConnection(),
      connectionStatus: "disconnected",
      serverCapabilities: null,
      mcpClient: null,
    }));
    rerender(<App />);

    // Should clear the hash
    await waitFor(() => {
      expect(mockHistory.replaceState).toHaveBeenCalledWith(null, "", "/");
    });
  });
});
