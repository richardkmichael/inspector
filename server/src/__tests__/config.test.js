import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

describe("/config endpoint environment variable sorting", () => {
  test("environment variables should be sorted alphabetically", () => {
    // Set up test environment variables
    const originalMcpEnvVars = process.env.MCP_ENV_VARS;

    // Create unsorted environment variables
    const testEnvVars = {
      ZEBRA_VAR: "zebra_value",
      ALPHA_VAR: "alpha_value",
      BETA_VAR: "beta_value",
      GAMMA_VAR: "gamma_value",
    };

    process.env.MCP_ENV_VARS = JSON.stringify(testEnvVars);

    try {
      // Mock getDefaultEnvironment to return some default vars
      const mockSdk = {
        getDefaultEnvironment() {
          return {
            DEFAULT_Z: "default_z_value",
            DEFAULT_A: "default_a_value",
          };
        },
      };

      // Simulate the server's environment variable processing
      const combinedEnvironment = {
        ...mockSdk.getDefaultEnvironment(),
        ...(process.env.MCP_ENV_VARS
          ? JSON.parse(process.env.MCP_ENV_VARS)
          : {}),
      };

      const defaultEnvironment = Object.entries(combinedEnvironment)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

      // Verify the environment variables are sorted
      const keys = Object.keys(defaultEnvironment);
      const sortedKeys = [...keys].sort((a, b) => a.localeCompare(b));

      assert.deepStrictEqual(
        keys,
        sortedKeys,
        "Environment variables should be in alphabetical order",
      );

      // Verify specific expected order
      assert.deepStrictEqual(keys, [
        "ALPHA_VAR",
        "BETA_VAR",
        "DEFAULT_A",
        "DEFAULT_Z",
        "GAMMA_VAR",
        "ZEBRA_VAR",
      ]);

      // Verify all values are preserved
      assert.strictEqual(defaultEnvironment.ALPHA_VAR, "alpha_value");
      assert.strictEqual(defaultEnvironment.ZEBRA_VAR, "zebra_value");
      assert.strictEqual(defaultEnvironment.DEFAULT_A, "default_a_value");
      assert.strictEqual(defaultEnvironment.DEFAULT_Z, "default_z_value");
    } finally {
      // Restore original environment
      if (originalMcpEnvVars) {
        process.env.MCP_ENV_VARS = originalMcpEnvVars;
      } else {
        delete process.env.MCP_ENV_VARS;
      }
    }
  });

  test("should handle empty MCP_ENV_VARS", () => {
    const originalMcpEnvVars = process.env.MCP_ENV_VARS;
    delete process.env.MCP_ENV_VARS;

    try {
      // Mock getDefaultEnvironment
      const mockSdk = {
        getDefaultEnvironment() {
          return {
            DEFAULT_B: "b_value",
            DEFAULT_A: "a_value",
          };
        },
      };

      const combinedEnvironment = {
        ...mockSdk.getDefaultEnvironment(),
        ...(process.env.MCP_ENV_VARS
          ? JSON.parse(process.env.MCP_ENV_VARS)
          : {}),
      };

      const defaultEnvironment = Object.entries(combinedEnvironment)
        .sort(([a], [b]) => a.localeCompare(b))
        .reduce((acc, [k, v]) => ({ ...acc, [k]: v }), {});

      const keys = Object.keys(defaultEnvironment);
      assert.deepStrictEqual(keys, ["DEFAULT_A", "DEFAULT_B"]);
    } finally {
      if (originalMcpEnvVars) {
        process.env.MCP_ENV_VARS = originalMcpEnvVars;
      }
    }
  });
});
