// deploy bump
const DATA_URL = "PASTE_YOUR_SAME_JSON_URL_HERE";

// Manual extras (you can edit anytime)
const PLAYER_META = {
  MATT:  { quote: "Deal or Die.", rivalries: ["Sean – chaos neutralizer", "Skyler – rent wars"] },
  SEAN:  { quote: "One more turn and it’s over.", rivalries: ["Mattias – chess match", "Billy – wildcard menace"] },
  BILLY: { quote: "I was born for Forced Deal.", rivalries: ["Levi – set snatcher", "Gabe – bank bully"] },
  LEVI:  { quote: "Quiet hands, loud rent.", rivalries: ["Billy – property thief", "Blair – tempo battle"] },
  BLAIR: { quote: "Show me the rent card.", rivalries: ["Levi – grind game", "Mattias – spotlight match"] },
  GABE:  { quote: "Bank big. Ask questions later.", rivalries: ["Brad – late game bombs", "Sean – discipline vs chaos"] },
  BRAD:  { quote: "I’m just here to ruin your set.", rivalries: ["Gabe – bank wars", "Skyler – rent stacking"] },
  SKYLER:{ quote: "Rent first, friends later.", rivalries: ["Mattias – prime rivalry", "Sam – surprise swings"] },
  SAM:   { quote: "No one sees it coming.", rivalries: ["Skyler – fast starts", "Brett – table politics"] },
  BRETT: { quote: "It’s My Birthday. Pay up.", rivalries: ["Sam – mind games", "Max – sleeper"] },
  MAX:   { quote: "I don’t lose. I learn… then I win.", rivalries: ["Brett – showdown", "Blair – endgame"] },
};

function pct(wins, games) {
  if (!games) return "0.0%";
  return ((wins / games) * 100).toFixed(1) + "%";
}

function safe(s) {
  return String(s ?? "").replace(/[<>]/g, "");
}

async function loadPlayers() {
  const res = await fetch(DATA_URL);
  const data = await res.json();

  // Build stats from Players tab
  const stats = {};
  (data.players || []).forEach((p) => {
    if (String(p.active).toLowerCase() === "false") return;
    stats[p.player_id] = {
      id: p.player_id,
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  // Apply games (1 row per game)
  (data.games || []).forEach((g) => {
    const winner = String(g.winner_id || "").trim();
    (g.player_ids || []).forEach((pid) => {
      if (stats[pid]) stats[pid].games += 1;
    });
    if (stats[winner]) stats[winner].wins += 1;
  });

  const rows = Object.values(stats).map((s) => ({
    id: s.id,
    name: s.name,
    wins: s.wins,
    games: s.games,
    points: s.wins * 2,
    winPctText: pct(s.wins, s.games),
    winPctNum: s.games ? (s.wins / s.games) : 0,
    quote: PLAYER_META[s.id]?.quote || "—",
  }))
  .sort((a, b) => (b.points - a.points) || (b.winPctNum - a.winPctNum) || a.name.localeCompare(b.name));

  // Render
  const grid = document.getElementById("playersGrid");
  grid.innerHTML = "";

  rows.forEach((r, idx) => {
    const seed = idx + 1;
    const medal = seed === 1 ? "🥇" : seed === 2 ? "🥈" : seed === 3 ? "🥉" : `#${seed}`;

    const card = document.createElement("a");
    card.className = "player-card";
    card.href = `./player.html?id=${encodeURIComponent(r.id)}`;

    card.innerHTML = `
      <div class="card-top">
        <div class="card-badge">${medal}</div>
        <div class="card-title">
          <div class="card-name">${safe(r.name)}</div>
          <div class="card-id">${safe(r.id)}</div>
        </div>
      </div>

      <div class="card-art">
        <div class="card-art-inner">
          <div class="card-watermark">DEAL OR DIE</div>
          <div class="card-mini">🟧 🟦 🟩</div>
        </div>
      </div>

      <div class="card-stats">
        <div class="stat">
          <div class="k">W</div><div class="v">${r.wins}</div>
        </div>
        <div class="stat">
          <div class="k">G</div><div class="v">${r.games}</div>
        </div>
        <div class="stat">
          <div class="k">PTS</div><div class="v">${r.points}</div>
        </div>
        <div class="stat">
          <div class="k">WIN%</div><div class="v">${r.winPctText}</div>
        </div>
      </div>

      <div class="card-quote">“${safe(r.quote)}”</div>
    `;

    grid.appendChild(card);
  });

  document.getElementById("updated").textContent =
    "Last updated: " + new Date().toLocaleString();
}

loadPlayers().catch((e) => {
  console.error(e);
  document.getElementById("updated").textContent = "Failed to load players";
});
