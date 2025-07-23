import { render, waitFor } from "@testing-library/react";
import {
  mockLocation,
  mockHistory,
  defaultConnectionState,
  connectedConnectionState,
} from "./helpers/app-mocks";
import App from "../App";
import { useConnection } from "../lib/hooks/useConnection";

describe("App - URL Fragment Routing", () => {
  const mockUseConnection = jest.mocked(useConnection);

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocation.hash = "";
    // Override default to connected state for routing tests
    mockUseConnection.mockReturnValue({
      ...connectedConnectionState,
      serverCapabilities: { resources: { listChanged: true, subscribe: true } },
    });
  });

  test("sets default hash based on server capabilities priority", async () => {
    // Tab priority follows UI order: Resources | Prompts | Tools | Ping | Sampling | Roots | Auth
    // Server capabilities determine the first 3 tabs; if none are present, falls back to Ping
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
        ...connectedConnectionState,
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
      ...defaultConnectionState,
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
      ...defaultConnectionState,
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
