// Refreshes a Strava OAuth token and writes recent activities to _data/strava_activities.json
// and gear (bikes/shoes) to _data/strava_gear.json
// Required env vars: STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN

const fs = require("fs");
const path = require("path");

const { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_REFRESH_TOKEN } = process.env;

if (!STRAVA_CLIENT_ID || !STRAVA_CLIENT_SECRET || !STRAVA_REFRESH_TOKEN) {
  console.error("Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, or STRAVA_REFRESH_TOKEN env vars.");
  process.exit(1);
}

const ACTIVITIES_OUTPUT_PATH = path.join(__dirname, "..", "_data", "strava_activities.json");
const GEAR_OUTPUT_PATH = path.join(__dirname, "..", "_data", "strava_gear.json");
const ACTIVITY_COUNT = 15;
const FIELDS = ["id", "name", "type", "distance", "moving_time", "total_elevation_gain", "start_date_local", "start_latlng", "workout_type"];

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

async function getAthlete(accessToken) {
  const res = await fetch("https://www.strava.com/api/v3/athlete", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Athlete fetch failed: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function getGearDetail(accessToken, gearId) {
  const res = await fetch(`https://www.strava.com/api/v3/gear/${gearId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Gear fetch failed for ${gearId}: ${res.status} ${await res.text()}`);
  }

  return res.json();
}

async function getGear(accessToken) {
  const athlete = await getAthlete(accessToken);
  const summaries = [
    ...(athlete.bikes || []).map((g) => ({ ...g, gear_type: "bike" })),
    ...(athlete.shoes || []).map((g) => ({ ...g, gear_type: "shoe" })),
  ];

  const gear = [];
  for (const summary of summaries) {
    const detail = await getGearDetail(accessToken, summary.id);
    gear.push({
      id: detail.id,
      type: summary.gear_type,
      name: detail.name,
      brand_name: detail.brand_name,
      model_name: detail.model_name,
      distance: detail.distance,
      primary: detail.primary,
    });
  }

  return gear;
}

async function main() {
  const accessToken = await getAccessToken();

  const activities = await getRecentActivities(accessToken);
  const trimmedActivities = activities.map((activity) =>
    Object.fromEntries(FIELDS.map((field) => [field, activity[field]]))
  );
  fs.writeFileSync(ACTIVITIES_OUTPUT_PATH, JSON.stringify(trimmedActivities, null, 2) + "\n");
  console.log(`Wrote ${trimmedActivities.length} activities to ${ACTIVITIES_OUTPUT_PATH}`);

  const gear = await getGear(accessToken);
  fs.writeFileSync(GEAR_OUTPUT_PATH, JSON.stringify(gear, null, 2) + "\n");
  console.log(`Wrote ${gear.length} gear items to ${GEAR_OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
