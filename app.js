// Use your Apps Script Web App /exec URL here (recommended for stability)
const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

function pct(wins, games) {
  if (!games) return "0.0%";
  return ((wins / games) * 100).toFixed(1) + "%";
}

async function load() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  // Build base stats from Players sheet (starting totals)
  const stats = {};
  (data.players || []).forEach((p) => {
    if (String(p.active).toLowerCase() === "false") return;

    stats[p.player_id] = {
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  // Add logged Games on top of starting totals
  (data.games || []).forEach((g) => {
    const winner = String(g.winner_id || "").trim();

    // Everyone who played gets +1 game
    (g.player_ids || []).forEach((pid) => {
      if (stats[pid]) stats[pid].games += 1;
    });

    // Winner gets +1 win
    if (stats[winner]) stats[winner].wins += 1;
  });

  // Build sorted leaderboard rows
  const rows = Object.values(stats)
    .map((s) => ({
      name: s.name,
      wins: s.wins,
      games: s.games,
      points: s.wins * 2,
      winPct: pct(s.wins, s.games),
    }))
    .sort(
      (a, b) =>
        (b.points - a.points) ||
        (parseFloat(b.winPct) - parseFloat(a.winPct)) ||
        (b.wins - a.wins) ||
        (b.games - a.games)
    );

  // Render leaderboard
  const tbody = document.querySelector("#leaderboard tbody");
  tbody.innerHTML = "";

  rows.forEach((r, i) => {
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : (i + 1);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${medal}</td>
      <td>${r.name}</td>
      <td>${r.wins}</td>
      <td>${r.games}</td>
      <td>${r.points}</td>
      <td>${r.winPct}</td>
    `;
    tbody.appendChild(tr);
  });

  // --- Render game history ---
  const historyBody = document.querySelector("#history tbody");
  historyBody.innerHTML = "";

  // Map player_id -> name
  const idToName = {};
  Object.keys(stats).forEach((pid) => {
    idToName[pid] = stats[pid].name;
  });

  // newest first
  const gamesSorted = (data.games || []).slice().sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  // OPTIONAL: show only last 25 games
  gamesSorted.slice(0, 25).forEach((g) => {
    const tr = document.createElement("tr");

    const dateStr = g.date ? new Date(g.date).toLocaleString() : "";
    const winnerName = idToName[g.winner_id] || g.winner_id || "";
    const playersList = (g.player_ids || [])
      .map((pid) => idToName[pid] || pid)
      .join(", ");

    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${winnerName}</td>
      <td>${playersList}</td>
      <td>${g.notes || ""}</td>
    `;

    historyBody.appendChild(tr);
  });

  // Updated timestamp
  document.getElementById("updated").textContent =
    "Last updated: " + new Date().toLocaleString();
}

load().catch((err) => {
  console.error(err);
  document.getElementById("updated").textContent = "Failed to load data";
});

setInterval(load, 30000);
