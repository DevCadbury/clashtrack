import express from "express";
import { Client } from 'clashofclans.js';

const app = express();
const PORT = 3001;

const SHEET_API =
  "https://sheets.googleapis.com/v4/spreadsheets/1jgLwjwURKg5Uy-30g7VCLCM4Ee4a70tS4WnMoN0Ps18/values/sheet1?alt=json&key=AIzaSyDB0lrrh6eUR7sXsYga71YgfDcsvKrXK6g";

const client = new Client();
let cache = { lastUpdated: null, data: [] };

// Helper: normalize player tag
function normalizePlayerTag(tag) {
  if (!tag) return null;
  let cleanTag = tag.trim().toUpperCase();
  if (!cleanTag.startsWith('#')) {
    cleanTag = '#' + cleanTag;
  }
  return cleanTag;
}

// ✅ Fetch player info from Clash of Clans API
async function fetchCOCPlayer(playerTag) {
  const normalizedTag = normalizePlayerTag(playerTag);
  if (!normalizedTag) {
    console.error(`❌ Invalid player tag: ${playerTag}`);
    return null;
  }

  try {
    console.log(`🔍 Fetching player: ${normalizedTag}`);
    const player = await client.getPlayer(normalizedTag);
    console.log(`✅ Successfully fetched player: ${normalizedTag}`);
    return player;
  } catch (err) {
    console.error(`❌ Failed to fetch player ${normalizedTag}:`, err.message);
    return null;
  }
}

// Helper: fetch in batches with dynamic rate control
async function fetchPlayersInBatches(players, batchSize = 15, delayMs = 400) {
  const result = [];
  const totalBatches = Math.ceil(players.length / batchSize);
  console.log(`📦 Starting to process ${players.length} players in ${totalBatches} batches of up to ${batchSize}`);

  for (let i = 0; i < players.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize) + 1;
    const batch = players.slice(i, i + batchSize);
    console.log(`🔄 Processing batch ${batchIndex}/${totalBatches} (${batch.length} players)`);

    const batchResults = await Promise.all(
      batch.map(async (player) => {
        const cocData = await fetchCOCPlayer(player.playerTag);
        const currentClanName = cocData?.clan?.name || "No Clan";
        const currentClanTag = cocData?.clan?.tag || "None";

        // Check if player is in assigned clan
        const isInAssignedClan =
          player.assignedClanTag &&
          currentClanTag.replace("#", "").toUpperCase() ===
            player.assignedClanTag.replace("#", "").toUpperCase();

        return {
          ...player,
          currentClanName,
          currentClanTag,
          currentTownHall: cocData?.townHallLevel || null,
          isInAssignedClan,
        };
      })
    );

    const validResults = batchResults.filter(Boolean);
    result.push(...validResults);
    console.log(`✅ Batch ${batchIndex} completed: ${validResults.length}/${batch.length} players successfully processed`);

    if (i + batchSize < players.length) {
      console.log(`⏳ Waiting ${delayMs}ms before next batch...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.log(`🎉 All batches completed: ${result.length} players processed successfully`);
  return result;
}

// ✅ Update data function
async function updateData() {
  console.log("🔄 Updating data...");
  try {
    const res = await fetch(SHEET_API);
    const json = await res.json();
    const values = json.values || [];
    const rows = values.slice(1); // skip header row

    const players = rows
      .filter((row) => row[2]) // must have playerTag
      .map((row) => ({
        playerName: row[1],
        playerTag: normalizePlayerTag(row[2]),
        townHall: row[3],
        discordUsername: row[5],
        discordUserId: row[6],
        assignedClanName: row[7],
        assignedClanTag: normalizePlayerTag(row[8]),
      }));

    // Fetch all players in batches
    const allPlayers = await fetchPlayersInBatches(players);

    cache = { lastUpdated: new Date().toISOString(), data: allPlayers };
    console.log(`✅ Data updated: ${allPlayers.length} players.`);
  } catch (err) {
    console.error("❌ Error updating data:", err.message);
  }
}

// GET /api/players
// Filters: assignedClanTag, userId, playerTag, status=inClan|notInClan
app.get("/api/players", async (req, res) => {
  // Check if data needs updating (older than 3 minutes)
  if (!cache.lastUpdated || (new Date() - new Date(cache.lastUpdated)) > 3 * 60 * 1000) {
    console.log("🔄 Cache is stale, updating data...");
    await updateData();
  }

  let filtered = cache.data;
  const { assignedClanTag, userId, playerTag, status } = req.query;

  if (assignedClanTag) {
    const cleanTag = normalizePlayerTag(assignedClanTag).replace("#", "").toUpperCase();
    filtered = filtered.filter(
      (p) =>
        (p.assignedClanTag || "")
          .replace("#", "")
          .toUpperCase() === cleanTag
    );
  }

  if (userId) {
    filtered = filtered.filter((p) => p.discordUserId === userId);
  }

  if (playerTag) {
    const cleanTag = normalizePlayerTag(playerTag).replace("#", "").toUpperCase();
    filtered = filtered.filter(
      (p) =>
        (p.playerTag || "")
          .replace("#", "")
          .toUpperCase() === cleanTag
    );
  }

  if (status) {
    if (status === "inClan") {
      filtered = filtered.filter((p) => p.isInAssignedClan);
    } else if (status === "notInClan") {
      filtered = filtered.filter((p) => !p.isInAssignedClan);
    }
  }

  if (filtered.length === 0) {
    return res.json({
      lastUpdated: cache.lastUpdated,
      count: 0,
      message: "Not Found",
      data: [],
    });
  }

  res.json({
    lastUpdated: cache.lastUpdated,
    count: filtered.length,
    data: filtered,
  });
});

app.get("/", (req, res) => {
  res.send("✅ COC Clan Checker API is running.");
});

// Initialize client
(async function init() {
  try {
    await client.login({ email: process.env.COC_EMAIL, password: process.env.COC_PASSWORD });
    console.log("✅ Logged in to Clash of Clans API");
    await updateData();
  } catch (err) {
    console.error("❌ Failed to login:", err.message);
  }
})();

export default app;
