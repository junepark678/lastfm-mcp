import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { unstable_dev, type UnstableDevWorker } from "wrangler";

type JsonRpcResponse = { result?: Record<string, unknown> };

function mcpHeaders(sessionId?: string): HeadersInit {
  return {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    "mcp-protocol-version": "2025-03-26",
    ...(sessionId ? { "mcp-session-id": sessionId } : {}),
  };
}

async function parseMcpResponse(response: Response): Promise<JsonRpcResponse> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return await response.json() as JsonRpcResponse;
  }

  const body = await response.text();
  const dataLine = body.split("\n").find((line) => line.startsWith("data: "));
  expect(dataLine, `Expected SSE data line, got:\n${body}`).toBeTruthy();
  return JSON.parse((dataLine as string).slice(6)) as JsonRpcResponse;
}

describe("wrangler local development", () => {
  let worker: UnstableDevWorker;

  beforeAll(async () => {
    worker = await unstable_dev("src/index.ts", {
      experimental: { disableExperimentalWarning: true },
      vars: {
        LASTFM_API_KEY: "test-key",
        LASTFM_API_BASE_URL: "https://ws.audioscrobbler.com/2.0/",
      },
    });
  }, 60_000);

  afterAll(async () => {
    await worker?.stop();
  });

  it("supports initialize and exposes code mode tools in wrangler local dev", async () => {
    const initializeResponse = await worker.fetch("/mcp", {
      method: "POST",
      headers: mcpHeaders(),
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "vitest", version: "1.0.0" },
        },
      }),
    });

    expect(initializeResponse.status).toBe(200);
    const sessionId = initializeResponse.headers.get("mcp-session-id") ?? undefined;
    const initializeBody = await parseMcpResponse(initializeResponse);
    expect((initializeBody.result?.serverInfo as { name?: string } | undefined)?.name).toBe("codemode");

    const toolsListResponse = await worker.fetch("/mcp", {
      method: "POST",
      headers: mcpHeaders(sessionId),
      body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }),
    });

    expect(toolsListResponse.status).toBe(200);
    const toolsListBody = await parseMcpResponse(toolsListResponse);
    const tools = (toolsListBody.result?.tools as Array<{ name?: string; annotations?: Record<string, boolean> }> | undefined) ?? [];
    const toolNames = tools.map((tool) => tool.name);
    expect(toolNames).toContain("code");
    const codeTool = tools.find((tool) => tool.name === "code");
    expect(codeTool?.annotations?.readOnlyHint).toBe(true);
    expect(codeTool?.annotations?.destructiveHint).toBe(false);
    expect(codeTool?.annotations?.openWorldHint).toBe(true);
  }, 30_000);
});
