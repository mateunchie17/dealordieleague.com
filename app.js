const DATA_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AY5xjrTYZnYTE4pfc_K9_4ULH4jtuaht2i7ZHQOzvpzkfQ-HbJqt521qvocdiTwxf252cx275MLF_--lzUQbcvgQpeFYjtFB-e9H2q8Q0KnGnzmRZJyrjRQZe3frnVhv8Y7ksOdgYJLXbgc7ELM_FW-_w11LyQNC2fZjbMlbbFD1P-buJQBH5floBX8JiFwjYlG4BDhdxmGLocrh4wUXmuZRDCxSzvV5sYSvduM1p9nYJCnVpt-wyTNCsTarx7UviP8Tk_Pcwy96cWGCbRKgHRhUtJG9JyHARiHL0C286sl4&lib=MC224wZixs_4RDNExT7UVFRaw35ay4lOA";

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
    .sort((a, b) => b.points - a.points);

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
