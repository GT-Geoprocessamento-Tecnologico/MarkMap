import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

const MAX_CONNECTIONS_PER_WORKSPACE = 4;
const MAX_CONNECTIONS_GLOBAL = 100;
const CONNECTION_TIMEOUT_MS = 5 * 60_000;
const activeByWorkspace = new Map<string, number>();
let activeGlobal = 0;

export const notificationRoutes = (app: Hono<any, any, any>) => {
  app.get("/notifications", (c) => {
    if (c.req.raw.signal.aborted) return new Response(null, { status: 499 });
    const workspaceId = c.get("capabilityWorkspaceId") as string | undefined;
    if (workspaceId === undefined || workspaceId === "") {
      return c.json(
        {
          error: {
            code: "UNAUTHORIZED",
            message: "Workspace capability is required",
          },
        },
        401,
      );
    }
    const workspaceConnections = activeByWorkspace.get(workspaceId) ?? 0;
    if (
      activeGlobal >= MAX_CONNECTIONS_GLOBAL ||
      workspaceConnections >= MAX_CONNECTIONS_PER_WORKSPACE
    ) {
      c.header("Retry-After", "30");
      return c.json(
        {
          error: {
            code: "RATE_LIMITED",
            message: "Too many notification connections",
          },
        },
        429,
      );
    }
    activeByWorkspace.set(workspaceId, workspaceConnections + 1);
    activeGlobal += 1;
    return streamSSE(c, async (stream) => {
      let id = 0;
      await new Promise<void>((resolve) => {
        let settled = false;
        const timers: {
          intervalId?: ReturnType<typeof setInterval>;
          alertTimeoutId?: ReturnType<typeof setTimeout>;
          timeoutId?: ReturnType<typeof setTimeout>;
        } = {};
        let writeChain = Promise.resolve();
        const release = () => {
          const current = activeByWorkspace.get(workspaceId) ?? 1;
          if (current <= 1) activeByWorkspace.delete(workspaceId);
          else activeByWorkspace.set(workspaceId, current - 1);
          activeGlobal = Math.max(0, activeGlobal - 1);
        };
        const finish = () => {
          if (settled) return;
          settled = true;
          if (timers.intervalId) clearInterval(timers.intervalId);
          if (timers.alertTimeoutId) clearTimeout(timers.alertTimeoutId);
          if (timers.timeoutId) clearTimeout(timers.timeoutId);
          c.req.raw.signal.removeEventListener("abort", finish);
          // Unblock a pending writer when the lifetime expires or the request aborts.
          // Hono's abort path cancels the underlying readable stream and makes
          // the writer reject, allowing streamSSE's final close to complete.
          stream.abort();
          release();
          resolve();
        };
        const enqueue = (message: Parameters<typeof stream.writeSSE>[0]) => {
          writeChain = writeChain
            .then(async () => {
              if (settled) return;
              await stream.writeSSE(message);
            })
            .catch(finish);
        };
        const writePing = () =>
          enqueue({
            data: JSON.stringify({
              message: "Ping",
              timestamp: new Date().toISOString(),
            }),
            event: "ping",
            id: String(id++),
          });
        stream.onAbort(finish);
        c.req.raw.signal.addEventListener("abort", finish, { once: true });
        if (c.req.raw.signal.aborted) {
          finish();
          return;
        }
        timers.intervalId = setInterval(writePing, 5000);
        timers.alertTimeoutId = setTimeout(() => {
          enqueue({
            data: JSON.stringify({
              message: "Processamento Concluído",
              status: "success",
            }),
            event: "alert",
            id: String(id++),
          });
        }, 10_000);
        timers.timeoutId = setTimeout(finish, CONNECTION_TIMEOUT_MS);
      });
    });
  });
};
