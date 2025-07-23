import { render, waitFor } from "@testing-library/react";
import { DEFAULT_INSPECTOR_CONFIG } from "./helpers/app-mocks";
import App from "../App";
import { InspectorConfig } from "../lib/configurationTypes";
import * as configUtils from "../utils/configUtils";

// Get references to the mocked functions
const mockGetMCPProxyAuthToken = configUtils.getMCPProxyAuthToken as jest.Mock;
const mockInitializeInspectorConfig =
  configUtils.initializeInspectorConfig as jest.Mock;

describe("App - Config Endpoint", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () =>
        Promise.resolve({
          defaultEnvironment: { TEST_ENV: "test" },
          defaultCommand: "test-command",
          defaultArgs: "test-args",
        }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();

    // Reset getMCPProxyAuthToken to default behavior
    mockGetMCPProxyAuthToken.mockImplementation((config: InspectorConfig) => ({
      token: config.MCP_PROXY_AUTH_TOKEN.value,
      header: "X-MCP-Proxy-Auth",
    }));
  });

  test("sends X-MCP-Proxy-Auth header when fetching config with proxy auth token", async () => {
    const mockConfig = {
      ...DEFAULT_INSPECTOR_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_INSPECTOR_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    // Mock initializeInspectorConfig to return our test config
    mockInitializeInspectorConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:6277/config",
        {
          headers: {
            "X-MCP-Proxy-Auth": "Bearer test-proxy-token",
          },
        },
      );
    });
  });

  test("does not send auth header when proxy auth token is empty", async () => {
    const mockConfig = {
      ...DEFAULT_INSPECTOR_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_INSPECTOR_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "",
      },
    };

    // Mock initializeInspectorConfig to return our test config
    mockInitializeInspectorConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:6277/config",
        {
          headers: {},
        },
      );
    });
  });

  test("uses custom header name if getMCPProxyAuthToken returns different header", async () => {
    const mockConfig = {
      ...DEFAULT_INSPECTOR_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_INSPECTOR_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    // Mock to return a custom header name
    mockGetMCPProxyAuthToken.mockReturnValue({
      token: "test-proxy-token",
      header: "X-Custom-Auth",
    });
    mockInitializeInspectorConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "http://localhost:6277/config",
        {
          headers: {
            "X-Custom-Auth": "Bearer test-proxy-token",
          },
        },
      );
    });
  });

  test("config endpoint response updates app state", async () => {
    const mockConfig = {
      ...DEFAULT_INSPECTOR_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_INSPECTOR_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    mockInitializeInspectorConfig.mockReturnValue(mockConfig);

    render(<App />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    // Verify the fetch was called with correct parameters
    expect(global.fetch).toHaveBeenCalledWith(
      "http://localhost:6277/config",
      expect.objectContaining({
        headers: expect.objectContaining({
          "X-MCP-Proxy-Auth": "Bearer test-proxy-token",
        }),
      }),
    );
  });

  test("handles config endpoint errors gracefully", async () => {
    const mockConfig = {
      ...DEFAULT_INSPECTOR_CONFIG,
      MCP_PROXY_AUTH_TOKEN: {
        ...DEFAULT_INSPECTOR_CONFIG.MCP_PROXY_AUTH_TOKEN,
        value: "test-proxy-token",
      },
    };

    mockInitializeInspectorConfig.mockReturnValue(mockConfig);

    // Mock fetch to reject
    (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

    // Spy on console.error
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    render(<App />);

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error fetching default environment:",
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });
});
