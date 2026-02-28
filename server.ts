import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const PORT = 3000;

  // Store connected clients
  const clients = new Set<WebSocket>();

  wss.on("connection", (ws) => {
    clients.add(ws);
    console.log("New client connected via WebSocket");

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        // Broadcast new order to all other clients
        if (data.type === "NEW_ORDER") {
          console.log("New order received, broadcasting...");
          clients.forEach((client) => {
            // We broadcast to everyone including the sender for simplicity, 
            // or we could exclude the sender. Let's send to all.
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify({ 
                type: "NEW_ORDER_NOTIFICATION", 
                order: data.order,
                timestamp: new Date().toISOString()
              }));
            }
          });
        }
      } catch (e) {
        console.error("Error parsing message", e);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      console.log("Client disconnected from WebSocket");
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
