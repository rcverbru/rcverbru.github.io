// Refreshes a Strava OAuth token and writes recent activities to _data/strava_activities.json
// Required env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN

const fs = require("fs");
const path = require("path");

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
  console.error("Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, or STRAVA_REFRESH_TOKEN env vars.");
  process.exit(1);
}

const OUTPUT_PATH = path.join(__dirname, "..", "_data", "strava_activities.json");
const ACTIVITY_COUNT = 5;
const FIELDS = ["id", "name", "type", "distance", "moving_time", "total_elevation_gain", "start_date_local", "start_latlng"];

async function getAccessToken() {
  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: STRAVA_REFRESH_TOKEN,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function getRecentActivities(accessToken) {
  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${ACTIVITY_COUNT}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`Activity fetch failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function main() {
  const accessToken = await getAccessToken();
  const activities = await getRecentActivities(accessToken);

  const trimmed = activities.map((activity) =>
    Object.fromEntries(FIELDS.map((field) => [field, activity[field]]))
  );

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(trimmed, null, 2) + "\n");
  console.log(`Wrote ${trimmed.length} activities to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
