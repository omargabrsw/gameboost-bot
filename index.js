import 'dotenv/config';
import express from 'express';

const app = express();
app.use(express.json()); // parse JSON body

// Discord sender
async function sendDiscordNotification(order) {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  const buyer = order.buyer.username;
  const game = order.game.name;
  const title = order.title;
  const quantity = order.quantity;
  const price = order.price_usd || order.price_eur || 'N/A';
  const status = order.status;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'GameBoost Bot',
      embeds: [
        {
          title: '🛒 New Order Purchased',
          color: 0x00ff99,
          fields: [
            { name: 'Order ID', value: String(order.id), inline: true },
            { name: 'Buyer', value: buyer, inline: true },
            { name: 'Game', value: game, inline: false },
            { name: 'Title', value: title, inline: false },
            { name: 'Quantity', value: String(quantity), inline: true },
            { name: 'Price', value: `$${price}`, inline: true },
            { name: 'Status', value: status, inline: true },
          ],
          timestamp: new Date().toISOString(),
        },
      ],
    }),
  });
}

// Webhook endpoint
app.post('/webhook/gameboost', async (req, res) => {
  const { event, payload } = req.body;

  if (event === 'item.order.purchased') {
    try {
      await sendDiscordNotification(payload);
      res.sendStatus(200);
    } catch (err) {
      console.error('Failed to send Discord notification:', err);
      res.sendStatus(500);
    }
  } else {
    res.sendStatus(204); // ignore other events
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});
