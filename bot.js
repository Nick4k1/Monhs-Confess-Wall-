const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");

const app = express();
app.use(bodyParser.json());

// Facebook App Credentials
const VERIFY_TOKEN = "bot";
const PAGE_ACCESS_TOKEN = "EAAUG0iogqEYBOzlhPBXXhYrrZAuwDxFpFo6OumL2rVEG650CZAArBhszRpSaTBo8mpCU4Hr1L25oUYp1xV1RV7xwEjiVqQggZApZBWu8zZAk9qLl37qC9ighzJgOx6XSnJYrriU0zZAbL8IubsJC4ssH1CnnF5jEAaGE3xv7y4hd43jj1ZAkIHtHDsWHa66XDazlQZDZD"; // Page token

// Cooldown settings
const COOLDOWN_PERIOD = 60 * 1000; // 60 seconds
const userCooldowns = new Map(); // Track users' last command timestamps

// Function to post to the Facebook page
async function postToFacebookPage(message) {
    const PAGE_ID = "61572215923283";
    const url = `https://graph.facebook.com/${PAGE_ID}/feed`;

    try {
        const response = await axios.post(url, { message }, {
            params: { access_token: PAGE_ACCESS_TOKEN },
        });
        console.log("Post ID:", response.data.id);
        return `Confession posted successfully! Post ID: ${response.data.id}`;
    } catch (error) {
        console.error("Error posting to Facebook Page:", error.response?.data || error.message);
        return "Failed to post the confession.";
    }
}

// Function to send a reply message to the user
async function sendMessage(senderId, messageText) {
    const url = `https://graph.facebook.com/v17.0/me/messages`;

    try {
        await axios.post(
            url,
            {
                recipient: { id: senderId },
                message: { text: messageText },
            },
            { params: { access_token: PAGE_ACCESS_TOKEN } }
        );
        console.log("Message sent to user:", messageText);
    } catch (error) {
        console.error("Error sending message:", error.response?.data || error.message);
    }
}

// Webhook Verification
app.get("/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        return res.status(200).send(challenge);
    } else {
        return res.sendStatus(403);
    }
});

// Webhook Event Handler
app.post("/webhook", async (req, res) => {
    const body = req.body;

    if (body.object === "page") {
        for (const entry of body.entry) {
            const webhookEvent = entry.messaging[0];

            if (webhookEvent && webhookEvent.message && webhookEvent.message.text) {
                const senderId = webhookEvent.sender.id;
                const receivedMessage = webhookEvent.message.text;

                console.log(`Received message: ${receivedMessage}`);

                // Check cooldown
                const lastCommandTime = userCooldowns.get(senderId);
                const currentTime = Date.now();

                if (lastCommandTime && currentTime - lastCommandTime < COOLDOWN_PERIOD) {
                    const remainingTime = Math.ceil((COOLDOWN_PERIOD - (currentTime - lastCommandTime)) / 1000);
                    await sendMessage(senderId, `Please wait ${remainingTime} seconds before sending another confession.`);
                    continue;
                }

                if (receivedMessage.toLowerCase().startsWith("confess")) {
                    const confession = receivedMessage.replace("confess", "").trim();

                    if (confession) {
                        // Post confession to the Facebook page
                        const responseMessage = await postToFacebookPage(confession);
                        await sendMessage(senderId, "Your confession has been posted anonymously!");

                        // Update the user's cooldown timestamp
                        userCooldowns.set(senderId, currentTime);
                    } else {
                        // Inform the user to provide text after "confess"
                        await sendMessage(senderId, "Please provide a confession after 'confess'. For example: 'confess I love pizza!'");
                    }
                } else {
                    // Inform the user how to use the bot
                    await sendMessage(senderId, "To submit a confession, send: confess <your_message>");
                }
            }
        }

        return res.status(200).send("EVENT_RECEIVED");
    } else {
        return res.sendStatus(404);
    }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Facebook Bot is running on port ${PORT}`);
});
    
