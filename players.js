// deploy bump
const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

// Custom quotes by player_id
const QUOTES = {
  MATT: "When you come for the king, you best not miss",
  SEAN: "If I had one more turn it would be over",
  GABE: "Im gonna have to charge you rent",
  BILLY: "I never get any good cards",
  BLAIR: "Show me that in the rule book",
  LEVI: "Wowwww this league is so corrupt",
  SKYLER: "I've got a mega brain strategy",
  BRAD: "NA - I never come to games",
  BRETT: "NA - I never come to games",
  MAX: "TBD",
  SAM: "I gotta get a dub",
};

// Helpers
function pct(wins, games) {
  if (!games) return "0.0%";
  return ((wins / games) * 100).toFixed(1) + "%";
}

function normalizeId(id) {
  return String(id || "").trim().toUpperCase();
}

async function loadPlayers() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  // Build stats from players + games (1 row per game)
  const stats = {};
  (data.players || []).forEach((p) => {
    if (String(p.active).toLowerCase() === "false") return;
    const pid = normalizeId(p.player_id);
    stats[pid] = {
      player_id: pid,
      name: p.name,
      wins: 0,
      games: 0,
    };
  });

  (data.games || []).forEach((g) => {
    const winner = normalizeId(g.winner_id);
    const pids = (g.player_ids || []).map(normalizeId).filter(Boolean);

    // everyone who played gets a game
    pids.forEach((pid) => {
      if (stats[pid]) stats[pid].games += 1;
    });

    // winner gets a win
    if (stats[winner]) stats[winner].wins += 1;
  });

  // Build rows
  const rows = Object.values(stats).map((s) => {
    const points = s.wins * 2;
    const winPct = pct(s.wins, s.games);
    return {
      player_id: s.player_id,
      name: s.name,
      wins: s.wins,
      games: s.games,
      points,
      winPct,
      winPctNum: s.games ? s.wins / s.games : 0,
      quote: QUOTES[s.player_id] || "",
    };
  });

  // Sort: Points desc, Win% desc, Wins desc, Name asc
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.winPctNum !== a.winPctNum) return b.winPctNum - a.winPctNum;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  // Render
  const grid = document.getElementById("cards");
  grid.innerHTML = "";

  rows.forEach((r, idx) => {
    const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx + 1}`;

    const card = document.createElement("a");
    card.className = "player-card";
    card.href = `player.html?id=${encodeURIComponent(r.player_id)}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="rank-pill">${medal}</div>
        <div class="name-block">
          <div class="player-name">${r.name}</div>
          <div class="player-id">${r.player_id}</div>
        </div>
      </div>

      <div class="art">
        <div class="art-label">DEAL OR DIE</div>
        <div class="prop-bars">
          <span class="bar orange"></span>
          <span class="bar blue"></span>
          <span class="bar green"></span>
        </div>
      </div>

      <div class="stats">
        <div class="stat"><div class="k">W</div><div class="v">${r.wins}</div></div>
        <div class="stat"><div class="k">G</div><div class="v">${r.games}</div></div>
        <div class="stat"><div class="k">PTS</div><div class="v">${r.points}</div></div>
        <div class="stat"><div class="k">WIN%</div><div class="v">${r.winPct}</div></div>
      </div>

      <div class="quote">"${r.quote}"</div>
    `;

    grid.appendChild(card);
  });

  const updated = document.getElementById("updated");
  if (updated) updated.textContent = "Last updated: " + new Date().toLocaleString();
}

loadPlayers().catch((e) => {
  console.error(e);
  const updated = document.getElementById("updated");
  if (updated) updated.textContent = "Failed to load data";
});
