/* players.js — Deal or Die League */

const DATA_URL = "PASTE_YOUR_JSON_URL_HERE";

/**
 * Optional: add photos by player_id.
 * Option A (recommended): upload images to repo in /players/ folder:
 *   players/MATT.jpg, players/SEAN.jpg, etc.
 * Then you can leave PHOTO_BY_ID empty and it will auto-try /players/{ID}.jpg
 *
 * Option B: set explicit URLs here:
 * const PHOTO_BY_ID = { MATT: "https://...", SEAN: "https://..." }
 */
const PHOTO_BY_ID = {
  // MATT: "players/MATT.jpg",
  // SEAN: "players/SEAN.jpg",
};

const DEFAULT_PHOTO = "players/default.jpg"; // optional (you can remove if you don’t have it)

const QUOTE_BY_ID = {
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

function photoUrlFor(id) {
  // explicit mapping wins
  if (PHOTO_BY_ID[id]) return PHOTO_BY_ID[id];
  // otherwise auto-try repo path by convention
  return `players/${id}.jpg`;
}

function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  return String(v).toLowerCase() !== "false";
}

function safeText(v, fallback = "") {
  return (v === undefined || v === null) ? fallback : String(v);
}

function sortPlayers(a, b) {
  // Sort by Points DESC, then Win% DESC, then Wins DESC, then Games ASC, then Name ASC
  if (b.points !== a.points) return b.points - a.points;
  if (b.winPctNum !== a.winPctNum) return b.winPctNum - a.winPctNum;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (a.games !== b.games) return a.games - b.games;
  return a.name.localeCompare(b.name);
}

async function loadPlayers() {
  const updatedEl = document.getElementById("updated");
  const grid = document.getElementById("cards");

  try {
    if (!grid) throw new Error("Missing #cards element in players.html");

    updatedEl.textContent = "Loading…";

    const res = await fetch(DATA_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);

    const data = await res.json();
    const players = Array.isArray(data.players) ? data.players : [];
    const games = Array.isArray(data.games) ? data.games : [];

    // Build base stats from Players sheet
    const stats = {};
    for (const p of players) {
      const id = safeText(p.player_id).trim();
      if (!id) continue;

      if (!normalizeBool(p.active)) continue;

      stats[id] = {
        id,
        name: safeText(p.name, id),
        wins: Number(p.starting_wins || 0),
        games: Number(p.starting_games || 0),
      };
    }

    // Add game rows (one row per game, all players listed get +1 game; winner gets +1 win)
    for (const g of games) {
      const winner = safeText(g.winner_id).trim();
      const pids = Array.isArray(g.player_ids) ? g.player_ids : [];

      for (const pidRaw of pids) {
        const pid = safeText(pidRaw).trim();
        if (stats[pid]) stats[pid].games += 1;
      }
      if (stats[winner]) stats[winner].wins += 1;
    }

    // Turn into rows for rendering
    const rows = Object.values(stats).map(s => {
      const points = s.wins * 2;
      const winPctStr = pct(s.wins, s.games);
      const winPctNum = s.games ? (s.wins / s.games) : 0;

      return {
        id: s.id,
        name: s.name,
        wins: s.wins,
        games: s.games,
        points,
        winPct: winPctStr,
        winPctNum,
        quote: QUOTE_BY_ID[s.id] ?? "Deal or Die.",
        photo: photoUrlFor(s.id),
      };
    }).sort(sortPlayers);

    // Render
    grid.innerHTML = "";

    rows.forEach((r, i) => {
      const medal =
        i === 0 ? "🥇" :
        i === 1 ? "🥈" :
        i === 2 ? "🥉" :
        `#${i + 1}`;

      const rankClass =
        i === 0 ? "rank-1" :
        i === 1 ? "rank-2" :
        i === 2 ? "rank-3" : "";

      const card = document.createElement("a");
      card.className = `player-card ${rankClass}`;
      card.href = `player.html?id=${encodeURIComponent(r.id)}`;
      card.setAttribute("aria-label", `${r.name} profile`);

      card.innerHTML = `
        <div class="card-top">
          <div class="rank-pill">${medal}</div>
          <div class="name-block">
            <div class="player-name">${r.name}</div>
            <div class="player-id">${r.id}</div>
          </div>
        </div>

        <div class="player-photo">
          <img class="player-img" src="${r.photo}" alt="${r.name}" loading="lazy" />
          <div class="photo-overlay">
            <div class="overlay-title">DEAL OR DIE</div>

            <div class="prop-legend" title="Property set colors (for vibes only)">
              <span class="dot orange"></span><span class="lbl">Utilities</span>
              <span class="dot blue"></span><span class="lbl">Railroads</span>
              <span class="dot green"></span><span class="lbl">Full Sets</span>
            </div>
          </div>
        </div>

        <div class="stats">
          <div class="stat"><div class="k">Wins</div><div class="v">${r.wins}</div></div>
          <div class="stat"><div class="k">Games</div><div class="v">${r.games}</div></div>
          <div class="stat"><div class="k">Points</div><div class="v">${r.points}</div></div>
          <div class="stat win"><div class="k">Win %</div><div class="v">${r.winPct}</div></div>
        </div>

        <div class="quote">“${r.quote}”</div>
      `;

      // If photo missing, fall back to DEFAULT_PHOTO (if you have it), otherwise hide img
      const img = card.querySelector(".player-img");
      if (img) {
        img.onerror = () => {
          if (DEFAULT_PHOTO && DEFAULT_PHOTO !== "players/default.jpg") {
            img.src = DEFAULT_PHOTO;
            return;
          }
          // If you didn't create a default image, just hide the img
          img.style.display = "none";
        };
      }

      grid.appendChild(card);
    });

    updatedEl.textContent = "Last updated: " + new Date().toLocaleString();
  } catch (err) {
    console.error(err);
    if (updatedEl) updatedEl.textContent = "Failed to load data";
    if (grid) grid.innerHTML = "";
  }
}

loadPlayers();
setInterval(loadPlayers, 30000);
