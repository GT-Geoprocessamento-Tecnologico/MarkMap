import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

export const notificationRoutes = (app: Hono<any, any, any>) => {
  app.get("/notifications", (c) => {
    return streamSSE(c, async (stream) => {
      let id = 0;
      // Send a ping every 5 seconds
      const intervalId = setInterval(() => {
        stream.writeSSE({
          data: JSON.stringify({
            message: "Ping",
            timestamp: new Date().toISOString(),
          }),
          event: "ping",
          id: String(id++),
        });
      }, 5000);

      // Simulate a "Processing Completed" event after 10 seconds
      const timeoutId = setTimeout(() => {
        stream.writeSSE({
          data: JSON.stringify({
            message: "Processamento Concluído",
            status: "success",
          }),
          event: "alert",
          id: String(id++),
        });
      }, 10000);

      // Clean up on disconnect
      c.req.raw.signal.addEventListener("abort", () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      });

      // Keep the connection open
      await new Promise(() => {});
    });
  });
};
