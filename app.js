// Use your Apps Script Web App /exec URL here
const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

// How many players qualify for playoffs
const PLAYOFF_SPOTS = 6;

function winPctNum(wins, games) {
  if (!games) return 0;
  return wins / games; // 0..1
}

function winPctText(wins, games) {
  return (winPctNum(wins, games) * 100).toFixed(1) + "%";
}

async function load() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  // ----------------------------
  // Build stats from Players tab
  // ----------------------------
  const stats = {};
  (data.players || []).forEach((p) => {
    if (String(p.active).toLowerCase() === "false") return;

    stats[p.player_id] = {
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  // ----------------------------
  // Apply Games tab (1 row = 1 game)
  // date | winner_id | player_ids | notes
  // ----------------------------
  (data.games || []).forEach((g) => {
    const winner = String(g.winner_id || "").trim();

    // everyone who played gets +1 game
    (g.player_ids || []).forEach((pid) => {
      if (stats[pid]) stats[pid].games += 1;
    });

    // winner gets +1 win
    if (stats[winner]) stats[winner].wins += 1;
  });

  // ----------------------------
  // LEADERBOARD
  // Rules:
  // - Sort by Points desc
  // - If points tie, sort by Win% desc
  // - Display rank ties by Points (same rank label for same points)
  // - Playoff cutoff is based on POSITION (top 6 after tiebreak)
  // ----------------------------
  const leaderboardRows = Object.values(stats)
    .map((s) => ({
      name: s.name,
      wins: s.wins,
      games: s.games,
      points: s.wins * 2,
      winPctNum: winPctNum(s.wins, s.games),
      winPctText: winPctText(s.wins, s.games),
    }))
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return b.winPctNum - a.winPctNum;
    });

  const leaderboardBody = document.querySelector("#leaderboard tbody");
  leaderboardBody.innerHTML = "";

  let displayRank = 0;
  let lastPoints = null;

  leaderboardRows.forEach((r, i) => {
    // rank ties based on points
    if (r.points !== lastPoints) {
      displayRank = i + 1;
      lastPoints = r.points;
    }

    const rankLabel =
      displayRank === 1 ? "🥇" :
      displayRank === 2 ? "🥈" :
      displayRank === 3 ? "🥉" :
      String(displayRank);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rankLabel}</td>
      <td>${r.name}</td>
      <td>${r.wins}</td>
      <td>${r.games}</td>
      <td>${r.points}</td>
      <td>${r.winPctText}</td>
    `;
    leaderboardBody.appendChild(tr);

    // playoff cutoff based on POSITION (top N rows)
    if (i === PLAYOFF_SPOTS - 1) {
      const divider = document.createElement("tr");
      divider.className = "playoff-divider";
      divider.innerHTML = `<td colspan="6">Playoff cutoff (Top ${PLAYOFF_SPOTS})</td>`;
      leaderboardBody.appendChild(divider);
    }
  });

  // ----------------------------
  // GAME HISTORY (latest 25)
  // ----------------------------
  const historyBody = document.querySelector("#history tbody");
  historyBody.innerHTML = "";

  // player_id -> name map
  const idToName = {};
  Object.keys(stats).forEach((pid) => (idToName[pid] = stats[pid].name));

  // newest first
  const gamesSorted = (data.games || []).slice().sort((a, b) => {
    const da = new Date(a.date || 0).getTime();
    const db = new Date(b.date || 0).getTime();
    return db - da;
  });

  gamesSorted.slice(0, 25).forEach((g) => {
    const dateStr = g.date ? new Date(g.date).toLocaleString() : "";
    const winnerName = idToName[g.winner_id] || g.winner_id || "";
    const playersList = (g.player_ids || [])
      .map((pid) => idToName[pid] || pid)
      .join(", ");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${dateStr}</td>
      <td>${winnerName}</td>
      <td>${playersList}</td>
      <td>${g.notes || ""}</td>
    `;
    historyBody.appendChild(tr);
  });

  // ----------------------------
  // Timestamp
  // ----------------------------
  document.getElementById("updated").textContent =
    "Last updated: " + new Date().toLocaleString();
}

// Initial load + refresh loop
load().catch((err) => {
  console.error(err);
  document.getElementById("updated").textContent = "Failed to load data";
});

setInterval(load, 30000);
