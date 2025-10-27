import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const app = express();
const PORT = 3001;

const SHEET_API =
  "https://sheets.googleapis.com/v4/spreadsheets/1jgLwjwURKg5Uy-30g7VCLCM4Ee4a70tS4WnMoN0Ps18/values/sheet1?alt=json&key=AIzaSyDB0lrrh6eUR7sXsYga71YgfDcsvKrXK6g";

const COC_API_TOKEN = process.env.COC_API_TOKEN;
let cache = { lastUpdated: null, data: [] };

// ✅ Fetch player info from Clash of Clans API
async function fetchCOCPlayer(playerTag) {
  try {
    const encodedTag = encodeURIComponent(playerTag.trim());
    const url = `https://api.clashofclans.com/v1/players/${encodedTag}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${COC_API_TOKEN}` },
    });

    const data = await response.json();

    if (!response.ok || data.reason === "notFound" || !data.name) {
      return null;
    }

    return data;
  } catch (err) {
    console.error(`🔥 Fetch error for ${playerTag}:`, err.message);
    return null;
  }
}

// Helper: fetch in batches with dynamic rate control
async function fetchPlayersInBatches(players, batchSize = 15, delayMs = 400) {
  const result = [];
  for (let i = 0; i < players.length; i += batchSize) {
    const batch = players.slice(i, i + batchSize);

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
          isInAssignedClan,
        };
      })
    );

    result.push(...batchResults.filter(Boolean));
    await new Promise((r) => setTimeout(r, delayMs)); // wait before next batch
  }
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
        playerTag: row[2],
        townHall: row[3],
        discordUsername: row[5],
        discordUserId: row[6],
        assignedClanName: row[7],
        assignedClanTag: row[8],
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
app.get("/api/players", (req, res) => {
  let filtered = cache.data;
  const { assignedClanTag, userId, playerTag, status } = req.query;

  if (assignedClanTag) {
    const cleanTag = assignedClanTag.replace("#", "").toUpperCase();
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
    const cleanTag = playerTag.replace("#", "").toUpperCase();
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

// Update every 3 minutes
setInterval(updateData, 3 * 60 * 1000);
updateData();

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
