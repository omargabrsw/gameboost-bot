import "dotenv/config";
import express from "express";
import crypto from "crypto";
import fetch from "node-fetch";

const app = express();

// Store processed webhook IDs to avoid duplicates
const processedWebhooks = new Set();

// Middleware to capture raw body
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Discord sender
async function sendDiscordNotification(order) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const buyer = order.buyer?.username || "Unknown";
  const game = order.game?.name || "Unknown Game";
  const title = order.title || "No Title";
  const quantity = order.quantity || 1;
  const price = order.price_usd || order.price_eur || "N/A";
  const status = order.status || "unknown";

  // Color based on status
  let color = 0xff9900; // default orange
  if (status === "completed") color = 0x00ff00;
  if (status === "pending") color = 0xffcc00;
  if (status === "refunded") color = 0xff0000;

  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "@everyone 🛒 **New GameBoost order received!**",
      allowed_mentions: {
        parse: ["everyone"]
      },
      username: "GameBoost Bot",
      embeds: [
        {
          title: "🛒 New Order Purchased",
          color: color,
          fields: [
            { name: "Order ID", value: String(order.id), inline: true },
            { name: "Buyer", value: buyer, inline: true },
            { name: "Game", value: game, inline: false },
            { name: "Title", value: title, inline: false },
            { name: "Quantity", value: String(quantity), inline: true },
            { name: "Price", value: `$${price}`, inline: true },
            { name: "Status", value: status, inline: true }
          ],
          timestamp: new Date().toISOString()
        }
      ]
    }),
  });

}

// Verify signature
function verifySignature(rawBody, signature) {
  const secret = process.env.GAMEBOOST_SECRET;

  // TEST_MODE: skip verification
  if (process.env.TEST_MODE === "true") return true;

  if (!secret || !signature) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch (err) {
    return false;
  }
}

// Webhook endpoint
app.post("/webhook/gameboost", async (req, res) => {
  const userAgent = req.headers["user-agent"];
  const signature =
    req.headers["signature"] || req.headers["x-gameboost-signature"];

  // Verify User-Agent (required by GameBoost)
  if (userAgent !== "GameBoost Server") {
    console.log("⚠️ Invalid User-Agent:", userAgent);
    return res.sendStatus(401);
  }

  // Verify signature
  if (!verifySignature(req.rawBody, signature)) {
    console.log("⚠️ Invalid signature!");
    return res.sendStatus(401);
  }

  // Respond immediately (GameBoost retry protection)
  res.status(200).json({ received: true });

  setImmediate(async () => {
    const { event, payload } = req.body;
    const webhookId = `${event}_${payload?.id}`;

    if (processedWebhooks.has(webhookId)) {
      console.log(`Webhook ${webhookId} already processed.`);
      return;
    }

    try {
      if (event === "item.order.purchased") {
        await sendDiscordNotification(payload);
        console.log(`✅ Processed webhook ${webhookId}`);
      } else {
        console.log(`Ignored event type: ${event}`);
      }

      processedWebhooks.add(webhookId);
    } catch (err) {
      console.error("Failed to process webhook:", err);
    }
  });
});


// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Webhook server running on port ${PORT}`);
});
