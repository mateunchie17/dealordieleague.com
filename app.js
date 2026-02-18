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
  (data.players || []).forEach(p => {
    if (String(p.active).toLowerCase() === "false") return;

    stats[p.player_id] = {
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  // Add any logged Games on top of starting totals
  (data.games || []).forEach(g => {
    const winner = g.winner_id;
    (g.player_ids || []).forEach(pid => {
      if (stats[pid]) stats[pid].games += 1;
    });
    if (stats[winner]) stats[winner].wins += 1;
  });

  // Create sorted leaderboard rows
  const rows = Object.values(stats)
    .map(s => ({
      name: s.name,
      wins: s.wins,
      games: s.games,
      points: s.wins * 2,
      winPct: pct(s.wins, s.games),
    }))
    .sort((a, b) =>
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

  document.getElementById("updated").textContent =
    "Last updated: " + new Date().toLocaleString();
}

load().catch((err) => {
  console.error(err);
  document.getElementById("updated").textContent = "Failed to load data";
});

setInterval(load, 30000);
