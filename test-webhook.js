const crypto = require("crypto");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

// Try to load .env file
function loadEnvFile() {
  const envFiles = [".env.local", ".env"];
  for (const envFile of envFiles) {
    const envPath = path.join(process.cwd(), envFile);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, "utf8");
      content.split("\n").forEach((line) => {
        const match = line.match(/^([^=:#]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      });
      console.log(`Loaded environment from ${envFile}`);
      break;
    }
  }
}

loadEnvFile();

// Sample Zoom webhook payload for participant_joined event
const samplePayload = {
  event: "meeting.participant_joined",
  payload: {
    account_id: "test_account_123",
    account_email: "test@example.com",
    object: {
      id: "60c987a4-a979-4764-9181-3b3ee748d3f4", // Session UUID
      uuid: "60c987a4-a979-4764-9181-3b3ee748d3f4",
      host_id: "test_host_123",
      host_email: "host@example.com",
      topic: "Test Meeting",
      type: 2,
      start_time: new Date().toISOString(),
      timezone: "America/New_York",
      duration: 60,
      meeting_number: "123456789",
      participant: {
        user_id: "a1b2c3d4-e5f6-4789-a012-345678901234",
        user_name: "Test Participant",
        email: "participant@example.com",
        join_time: new Date().toISOString(),
        id: "a1b2c3d4-e5f6-4789-a012-345678901234",
      },
    },
  },
};

// Get webhook secret from environment
// You can also pass it as: ZOOM_WEBHOOK_SECRET=your_secret node test-webhook.js
const webhookSecret = process.env.ZOOM_WEBHOOK_SECRET;

if (!webhookSecret) {
  console.error("❌ Error: ZOOM_WEBHOOK_SECRET environment variable is not set.");
  console.error("Please set it before running:");
  console.error("  Windows: set ZOOM_WEBHOOK_SECRET=your_secret && node test-webhook.js");
  console.error("  Linux/Mac: ZOOM_WEBHOOK_SECRET=your_secret node test-webhook.js");
  process.exit(1);
}

// Generate HMAC signature (Zoom's method)
const timestamp = Date.now().toString();
const bodyString = JSON.stringify(samplePayload);
const message = `v0:${timestamp}:${bodyString}`;
const signature = `v0=${crypto.createHmac("sha256", webhookSecret).update(message).digest("hex")}`;

// Request options
const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/zoom/webhooks",
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-zm-signature": signature,
    "x-zm-request-timestamp": timestamp,
    Authorization: `Bearer ${webhookSecret}`, // Also try authorization header
  },
};

console.log("Sending test webhook request...");
console.log("Event:", samplePayload.event);
console.log("Meeting ID:", samplePayload.payload.object.id);
console.log("Participant:", samplePayload.payload.object.participant.user_name);
console.log("Signature:", signature.substring(0, 20) + "...");
console.log("");

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);
  console.log("");

  let data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log("Response:");
    try {
      const json = JSON.parse(data);
      console.log(JSON.stringify(json, null, 2));
    } catch (e) {
      console.log(data);
    }
    console.log("");
    console.log("✅ Request completed! Check PostHog for logged events.");
  });
});

req.on("error", (error) => {
  console.error("Error:", error);
});

req.write(JSON.stringify(samplePayload));
req.end();
