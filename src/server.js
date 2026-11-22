const express = require("express");
const { Client, GatewayIntentBits } = require("discord.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "16kb" }));

// Discord bot
const bot = new Client({
    intents: [GatewayIntentBits.Guilds]
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

// Discord test message
app.post("/v1/discord/test", authenticate, async (req, res) => {
    try {
        if (!bot.isReady()) {
            return res.status(503).json({
                success: false,
                error: "Discord bot is not ready"
            });
        }

        const channel = await bot.channels.fetch(
            process.env.DISCORD_CHANNEL_ID
        );

        if (!channel || !channel.isTextBased() || !channel.send) {
            return res.status(400).json({
                success: false,
                error: "Invalid or inaccessible channel"
            });
        }

        await channel.send({
            content: "[D] ProjectIntel Integration is online! Discord connection test successful.",
            allowedMentions: { parse: [] }
        });

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

// Roblox event receiver and Discord forwarding
app.post("/v1/roblox/events", authenticate, async (req, res) => {
    const { platform, event, placeId, serverId, data } = req.body;

    const allowedEvents = [
        "server_started",
        "server_status",
        "player_joined",
        "player_left"
    ];

    if (
        platform !== "roblox" ||
        !allowedEvents.includes(event) ||
        !data ||
        typeof data !== "object" ||
        Array.isArray(data)
    ) {
        return res.status(400).json({
            success: false,
            error: "Invalid event"
        });
    }

    if (!bot.isReady()) {
        return res.status(503).json({
            success: false,
            error: "Discord bot is not ready"
        });
    }

    try {
        const channel = await bot.channels.fetch(
            process.env.DISCORD_CHANNEL_ID
        );

        if (!channel || !channel.isTextBased() || !channel.send) {
            return res.status(500).json({
                success: false,
                error: "Discord channel unavailable"
            });
        }

        let message;

        switch (event) {
            case "server_started":
                message = "[R] Roblox server started";
                break;

            case "server_status":
                message = "[R] Roblox server status updated";
                break;

            case "player_joined": {
                const username = String(data.username || "Unknown").slice(0, 40);
                message = `[R] Player joined: ${username}`;
                break;
            }

            case "player_left": {
                const username = String(data.username || "Unknown").slice(0, 40);
                message = `[R] Player left: ${username}`;
                break;
            }
        }

        await channel.send({
            content: message,
            allowedMentions: { parse: [] }
        });

        console.log("[Roblox Event Forwarded]", {
            event,
            placeId,
            serverId
        });

        res.json({
            success: true,
            received: true,
            forwarded: true
        });

    } catch (error) {
        console.error("[Roblox Forwarding Error]", error);

        res.status(500).json({
            success: false,
            error: "Failed to forward Roblox event"
        });
    }
});

// Start backend
app.listen(PORT, () => {
    console.log(`[API] Running on port ${PORT}`);
});
