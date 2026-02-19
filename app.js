// Use your Apps Script Web App /exec URL here
const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

function pct(wins, games) {
  if (!games) return "0.0%";
  return ((wins / games) * 100).toFixed(1) + "%";
}

async function load() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();

    const stats = {};

    // Initialize players
    data.players.forEach(p => {
      if (String(p.active).toLowerCase() === "false") return;

      stats[p.player_id] = {
        name: p.name,
        wins: Number(p.starting_wins || 0),
        games: Number(p.starting_games || 0)
      };
    });

    // Process games
    data.games.forEach(g => {
      const winner = g.winner_id;

      (g.player_ids || []).forEach(pid => {
        if (stats[pid]) stats[pid].games += 1;
      });

      if (stats[winner]) stats[winner].wins += 1;
    });

    // Build rows
    const rows = Object.values(stats).map(s => ({
      name: s.name,
      wins: s.wins,
      games: s.games,
      points: s.wins * 2,
      winPct: Number(pct(s.wins, s.games).replace("%", "")),
      winPctDisplay: pct(s.wins, s.games)
    }));

    // Sort
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.games - a.games;
    });

    renderLeaderboard(rows);
    renderHistory(data.games || []);

    document.getElementById("updated").textContent =
      "Last updated: " + new Date().toLocaleString();

  } catch (err) {
    console.error(err);
    document.getElementById("updated").textContent = "Failed to load data";
  }
}


function renderLeaderboard(rows) {
  const tbody = document.querySelector("#leaderboard tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  let currentRank = 0;
  let lastPoints = null;
  let lastPct = null;

  rows.forEach((r, i) => {

    if (r.points !== lastPoints || r.winPct !== lastPct) {
      currentRank = i + 1;
      lastPoints = r.points;
      lastPct = r.winPct;
    }

    // Insert playoff divider after rank 6
    if (currentRank === 7 && !document.querySelector(".playoffs-row")) {
      const playoffRow = document.createElement("tr");
      playoffRow.className = "playoffs-row";
      playoffRow.innerHTML = `
        <td colspan="6" class="playoffs-cell">🏆 PLAYOFFS (Top 6)</td>
      `;
      tbody.appendChild(playoffRow);
    }

    const medal =
      currentRank === 1 ? "🥇" :
      currentRank === 2 ? "🥈" :
      currentRank === 3 ? "🥉" :
      currentRank;

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="num">${medal}</td>
      <td>${r.name}</td>
      <td>${r.wins}</td>
      <td>${r.games}</td>
      <td>${r.points}</td>
      <td>${r.winPctDisplay}</td>
    `;

    tbody.appendChild(tr);
  });
}


function renderHistory(games) {
  const tbody = document.querySelector("#history tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  games
    .slice()
    .reverse()
    .forEach(g => {

      const date = new Date(g.date).toLocaleDateString();

      const tr = document.createElement("tr");

      tr.innerHTML = `
        <td>${date}</td>
        <td>${g.winner_id || ""}</td>
        <td>${(g.player_ids || []).join(", ")}</td>
        <td>${g.notes || ""}</td>
      `;

      tbody.appendChild(tr);
    });
}


load();
setInterval(load, 30000);
