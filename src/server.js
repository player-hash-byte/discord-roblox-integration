
const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "16kb" }));

const bot = new Client({
    intents: [GatewayIntentBits.Guilds]
});

bot.once("ready", () => {
    console.log(`[Discord] Logged in as ${bot.user.tag}`);
});

bot.login(process.env.DISCORD_TOKEN).catch(console.error);

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

app.get("/health", (req, res) => {
    res.json({
        status: "online",
        service: "Discord-Roblox Integration",
        discord: bot.isReady() ? "connected" : "connecting"
    });
});

// Send a test message to Discord
app.post("/v1/discord/test", authenticate, async (req, res) => {
    try {
        if (!bot.isReady()) {
            return res.status(503).json({
                success: false,
                error: "Discord bot is not ready"
            });
        }

        const channelId = process.env.DISCORD_CHANNEL_ID;

        if (!channelId) {
            return res.status(500).json({
                success: false,
                error: "DISCORD_CHANNEL_ID is missing"
            });
        }

        const channel = await bot.channels.fetch(channelId);

        if (!channel || !channel.isTextBased() || !channel.send) {
            return res.status(400).json({
                success: false,
                error: "Invalid or inaccessible text channel"
            });
        }

        await channel.send(
            "[D] ProjectIntel Integration is online! Discord connection test successful."
        );

        res.json({
            success: true,
            message: "Test message sent"
        });

    } catch (error) {
        console.error("[Discord Test Error]", error);

        res.status(500).json({
            success: false,
            error: "Failed to send test message"
        });
    }
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

    if (platform !== "roblox" || !allowedEvents.includes(event)) {
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

app.listen(PORT, () => {
    console.log(`[API] Running on port ${PORT}`);
});
