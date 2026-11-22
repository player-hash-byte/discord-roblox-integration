const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "16kb" }));

// Discord bot
const bot = new Client({
    intents: [
        GatewayIntentBits.Guilds
    ]
});

bot.once("ready", () => {
    console.log(`[Discord] Logged in as ${bot.user.tag}`);
});

bot.login(process.env.DISCORD_TOKEN).catch(console.error);

// API authentication
function authenticate(req, res, next) {
    const key = process.env.INTEGRATION_API_KEY;

    if (!key || req.headers.authorization !== `Bearer ${key}`) {
        return res.status(401).json({
            success: false,
            error: "Unauthorized"
        });
    }

    next();
}

// Health check
app.get("/health", (req, res) => {
    res.json({
        status: "online",
        service: "Discord-Roblox Integration",
        discord: bot.isReady() ? "connected" : "connecting"
    });
});

// Roblox event receiver
app.post("/v1/roblox/events", authenticate, (req, res) => {
    const { platform, event, placeId, serverId, data } = req.body;

    const allowedEvents = [
        "server_started",
        "server_status",
        "player_joined",
        "player_left"
    ];

    if (
        platform !== "roblox" ||
        !allowedEvents.includes(event)
    ) {
        return res.status(400).json({
            success: false,
            error: "Invalid event"
        });
    }

    console.log("[Roblox Event]", {
        event,
        placeId,
        serverId,
        data
    });

    res.json({
        success: true,
        received: true
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`[API] Running on port ${PORT}`);
});
