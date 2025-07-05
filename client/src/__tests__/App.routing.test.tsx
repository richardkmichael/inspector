import { render, waitFor } from "@testing-library/react";
import {
  mockLocation,
  mockHistory,
  defaultConnectionState,
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
      ...defaultConnectionState,
      connectionStatus: "connected",
      serverCapabilities: { resources: true },
      mcpClient: {},
    });
  });

  test("sets default hash based on server capabilities priority", async () => {
    const testCases = [
      { capabilities: { resources: true }, expected: "resources" },
      { capabilities: { prompts: true }, expected: "prompts" },
      { capabilities: { tools: true }, expected: "tools" },
      { capabilities: {}, expected: "ping" },
      {
        capabilities: { resources: true, prompts: true },
        expected: "resources",
      },
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
