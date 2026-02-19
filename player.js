const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

// Manual-only content (edit whenever)
const PLAYER_META = {
  MATT:  { quote: "Deal or Die.", rivalries: ["Sean — chaos neutralizer", "Skyler — rent wars"] },
  SEAN:  { quote: "One more turn and it’s over.", rivalries: ["Mattias — chess match", "Billy — wildcard menace"] },
  BILLY: { quote: "I was born for Forced Deal.", rivalries: ["Levi — set snatcher", "Gabe — bank bully"] },
  LEVI:  { quote: "Quiet hands, loud rent.", rivalries: ["Billy — property thief", "Blair — tempo battle"] },
  BLAIR: { quote: "Show me the rent card.", rivalries: ["Levi — grind game", "Mattias — spotlight match"] },
  GABE:  { quote: "Bank big. Ask questions later.", rivalries: ["Brad — late game bombs", "Sean — discipline vs chaos"] },
  BRAD:  { quote: "I’m just here to ruin your set.", rivalries: ["Gabe — bank wars", "Skyler — rent stacking"] },
  SKYLER:{ quote: "Rent first, friends later.", rivalries: ["Mattias — prime rivalry", "Sam — surprise swings"] },
  SAM:   { quote: "No one sees it coming.", rivalries: ["Skyler — fast starts", "Brett — table politics"] },
  BRETT: { quote: "It’s My Birthday. Pay up.", rivalries: ["Sam — mind games", "Max — sleeper"] },
  MAX:   { quote: "I don’t lose. I learn… then I win.", rivalries: ["Brett — showdown", "Blair — endgame"] },
};

function pct(wins, games) {
  if (!games) return "0.0%";
  return ((wins / games) * 100).toFixed(1) + "%";
}

function safe(s) {
  return String(s ?? "").replace(/[<>]/g, "");
}

function getParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

async function loadProfile() {
  const id = (getParam("id") || "").trim();
  if (!id) {
    document.getElementById("playerName").textContent = "Player not found";
    document.getElementById("playerTag").textContent = "Missing ?id=PLAYER_ID";
    document.getElementById("updated").textContent = "";
    return;
  }

  const res = await fetch(DATA_URL);
  const data = await res.json();

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

  (data.games || []).forEach((g) => {
    const winner = String(g.winner_id || "").trim();
    (g.player_ids || []).forEach((pid) => {
      if (stats[pid]) stats[pid].games += 1;
    });
    if (stats[winner]) stats[winner].wins += 1;
  });

  const p = stats[id];
  if (!p) {
    document.getElementById("playerName").textContent = "Player not found";
    document.getElementById("playerTag").textContent = `Unknown player_id: ${safe(id)}`;
    document.getElementById("updated").textContent = "";
    return;
  }

  const points = p.wins * 2;
  const winPctText = pct(p.wins, p.games);

  document.getElementById("playerName").textContent = p.name;
  document.getElementById("playerTag").textContent = `Player ID: ${safe(id)}`;
  document.getElementById("updated").textContent = "Last updated: " + new Date().toLocaleString();

  // Quote + Rivalries (manual)
  const meta = PLAYER_META[id] || { quote: "—", rivalries: [] };
  document.getElementById("playerQuote").textContent = meta.quote || "—";

  const rivEl = document.getElementById("playerRivalries");
  rivEl.innerHTML = "";
  (meta.rivalries || []).forEach((r) => {
    const li = document.createElement("li");
    li.textContent = r;
    rivEl.appendChild(li);
  });

  // Baseball card block
  const card = document.getElementById("profileCard");
  card.innerHTML = `
    <div class="baseball-card">
      <div class="bc-top">
        <div class="bc-title">
          <div class="bc-name">${safe(p.name)}</div>
          <div class="bc-sub">DEAL OR DIE • ${safe(id)}</div>
        </div>
        <div class="bc-badge">PLAYER</div>
      </div>

      <div class="bc-art">
        <div class="bc-watermark">PROPERTY KING</div>
        <div class="bc-icons">🟧 🟦 🟩</div>
      </div>

      <div class="bc-stats">
        <div class="bc-stat"><div class="k">Wins</div><div class="v">${p.wins}</div></div>
        <div class="bc-stat"><div class="k">Games</div><div class="v">${p.games}</div></div>
        <div class="bc-stat"><div class="k">Points</div><div class="v">${points}</div></div>
        <div class="bc-stat"><div class="k">Win %</div><div class="v">${winPctText}</div></div>
      </div>

      <div class="bc-footer">“${safe(meta.quote || "—")}”</div>
    </div>
  `;
}

loadProfile().catch((e) => {
  console.error(e);
  document.getElementById("playerName").textContent = "Failed to load player";
  document.getElementById("playerTag").textContent = "Check DATA_URL in player.js";
  document.getElementById("updated").textContent = "";
});
