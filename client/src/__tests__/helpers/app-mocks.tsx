import { DEFAULT_INSPECTOR_CONFIG } from "../../lib/constants";
import { InspectorConfig } from "../../lib/configurationTypes";

// Mock auth dependencies first
jest.mock("@modelcontextprotocol/sdk/client/auth.js", () => ({
  auth: jest.fn(),
}));

jest.mock("../../lib/oauth-state-machine", () => ({
  OAuthStateMachine: jest.fn(),
}));

jest.mock("../../lib/auth", () => ({
  InspectorOAuthClientProvider: jest.fn().mockImplementation(() => ({
    tokens: jest.fn().mockResolvedValue(null),
    clear: jest.fn(),
  })),
  DebugInspectorOAuthClientProvider: jest.fn(),
}));

// Mock the config utils
jest.mock("../../utils/configUtils", () => ({
  ...jest.requireActual("../../utils/configUtils"),
  getMCPProxyAddress: jest.fn(() => "http://localhost:6277"),
  getMCPProxyAuthToken: jest.fn((config: InspectorConfig) => ({
    token: config.MCP_PROXY_AUTH_TOKEN.value,
    header: "X-MCP-Proxy-Auth",
  })),
  getInitialTransportType: jest.fn(() => "stdio"),
  getInitialSseUrl: jest.fn(() => "http://localhost:3001/sse"),
  getInitialCommand: jest.fn(() => "mcp-server-everything"),
  getInitialArgs: jest.fn(() => ""),
  initializeInspectorConfig: jest.fn(() => DEFAULT_INSPECTOR_CONFIG),
  saveInspectorConfig: jest.fn(),
}));

// Default connection state is disconnected
export const disconnectedConnectionState = {
  connectionStatus: "disconnected" as const,
  serverCapabilities: null,
  mcpClient: null,
  requestHistory: [],
  makeRequest: jest.fn(),
  sendNotification: jest.fn(),
  handleCompletion: jest.fn(),
  completionsSupported: false,
  connect: jest.fn(),
  disconnect: jest.fn(),
};

// Connected state for tests that need an active connection
// Empty server capabilities, which causes the app to fall back to the "Ping" tab
export const connectedConnectionState = {
  ...disconnectedConnectionState,
  connectionStatus: "connected" as const,
  serverCapabilities: {},
  mcpClient: {} as object,
};

// Mock other dependencies
jest.mock("../../lib/hooks/useConnection", () => ({
  useConnection: jest.fn(() => disconnectedConnectionState),
}));

jest.mock("../../lib/hooks/useDraggablePane", () => ({
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

jest.mock("../../components/Sidebar", () => ({
  __esModule: true,
  default: () => <div>Sidebar</div>,
}));

// Mock fetch
global.fetch = jest.fn().mockResolvedValue({ json: () => Promise.resolve({}) });

// Mock window.location and window.history
export const mockLocation = { hash: "", pathname: "/", search: "" };
export const mockHistory = { replaceState: jest.fn() };
Object.defineProperty(window, "location", {
  value: mockLocation,
  writable: true,
});
Object.defineProperty(window, "history", {
  value: mockHistory,
  writable: true,
});

// Export references to the mocked functions for test use
export { DEFAULT_INSPECTOR_CONFIG };
