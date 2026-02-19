// 1) IMPORTANT: paste the SAME JSON URL you use in app.js
const DATA_URL = "PASTE_YOUR_SAME_JSON_URL_HERE";

const QUOTES = {
  MATT: "When you come for the king, you best not miss",
  SEAN: "If i had one more turn it would be over",
  GABE: "Im gonna have to charge you rent",
  BILLY: "I never get any good cards",
  BLAIR: "Show me that in the rule book",
  LEVI: "Wowwww this league is so corrupt",
  SKYLER: "I've got a mega brain strategy",
  BRAD: "NA - i never come to games",
  BRETT: "NA - I never come to games",
  MAX: "TBD",
  SAM: "I gotta get a dub",
};

function pct(wins, games) {
  if (!games) return "0.0%";
  return ((wins / games) * 100).toFixed(1) + "%";
}

function safeId(x) {
  return String(x || "").trim().toUpperCase();
}

async function loadPlayers() {
  const updatedEl = document.getElementById("updated");
  const grid = document.getElementById("cards");

  try {
    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const data = await res.json();

    // Build stats from players sheet
    const stats = {};
    (data.players || []).forEach((p) => {
      if (String(p.active).toLowerCase() === "false") return;

      const id = safeId(p.player_id);
      stats[id] = {
        id,
        name: p.name || id,
        wins: Number(p.starting_wins || 0),
        games: Number(p.starting_games || 0),
      };
    });

    // Apply game history (IMPORTANT: 1 row per game, player_ids is array)
    (data.games || []).forEach((g) => {
      const winner = safeId(g.winner_id);
      const players = Array.isArray(g.player_ids) ? g.player_ids.map(safeId) : [];

      // Count games played for each participant
      players.forEach((pid) => {
        if (stats[pid]) stats[pid].games += 1;
      });

      // Count win for winner
      if (stats[winner]) stats[winner].wins += 1;
    });

    // Convert to rows for rendering
    const rows = Object.values(stats).map((s) => {
      const points = s.wins * 2;
      const winPct = pct(s.wins, s.games);
      const winPctNum = s.games ? s.wins / s.games : 0;

      return {
        id: s.id,
        name: s.name,
        wins: s.wins,
        games: s.games,
        points,
        winPct,
        winPctNum,
        quote: QUOTES[s.id] || "TBD",
      };
    });

    // Sort: Points desc, Win% desc, Wins desc
    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.winPctNum !== a.winPctNum) return b.winPctNum - a.winPctNum;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return a.name.localeCompare(b.name);
    });

    // Render
    grid.innerHTML = "";

    rows.forEach((r, idx) => {
      const rank = idx + 1;
      const medal =
        rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : `#${rank}`;

      const card = document.createElement("a");
      card.className = "player-card";
      card.href = `/player.html?id=${encodeURIComponent(r.id)}`;

      card.innerHTML = `
        <div class="card-top">
          <div class="rank-pill">${medal}</div>
          <div class="name-block">
            <div class="player-name">${r.name}</div>
            <div class="player-id">${r.id}</div>
          </div>
        </div>

        <div class="player-photo">
          <!-- placeholder for now; we'll add real photos next -->
          <div class="photo-overlay">
            <div class="overlay-title">DEAL OR DIE</div>
            <div class="prop-bars">
              <span class="bar orange"></span>
              <span class="bar blue"></span>
              <span class="bar green"></span>
            </div>
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

    updatedEl.textContent = "Last updated: " + new Date().toLocaleString();
  } catch (err) {
    console.error(err);
    updatedEl.textContent = "Failed to load data";
    if (grid) grid.innerHTML = "";
  }
}

// Load now + refresh every 30s
loadPlayers();
setInterval(loadPlayers, 30000);
