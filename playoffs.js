// Uses the same data feed as the Standings page
const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

// Local (browser) persistence for bracket picks.
// Note: This does NOT change standings; it only remembers your playoff selections on this device.
const PICKS_KEY = "dod_playoffs_picks_v1";

function pct(wins, games) {
  if (!games) return 0;
  return wins / games;
}

function getPicks() {
  try {
    const raw = localStorage.getItem(PICKS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePicks(picks) {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks || {}));
  } catch {}
}

function clearInvalidPicks(picks, matchTeamsById) {
  // Remove picks that no longer match the teams in that match (e.g., seeding changed).
  const clean = { ...(picks || {}) };
  for (const [matchId, winnerSeed] of Object.entries(clean)) {
    const teams = matchTeamsById[matchId] || [];
    const ok = teams.some(t => String(t.seed) === String(winnerSeed) && t.name && t.name !== "TBD");
    if (!ok) delete clean[matchId];
  }
  return clean;
}

function teamRow({ matchId, seed, name, selected, disabled }) {
  const safeName = name || "TBD";
  const cls = ["team"];
  if (selected) cls.push("selected");
  if (disabled) cls.push("disabled");
  const pickIcon = selected ? "✓" : " ";
  return `
    <div class="${cls.join(" ")}" data-match="${matchId}" data-seed="${seed}" role="button" tabindex="0" aria-label="Pick ${safeName}">
      <span class="seed">${seed}</span>
      <span class="name">${safeName}</span>
      <span class="pick" aria-hidden="true">${pickIcon}</span>
    </div>
  `;
}

function matchCard({ matchId, title, subtitle, teams }) {
  return `
    <div class="match" data-match-id="${matchId}">
      <div class="match-h">
        <div class="match-title">${title}</div>
        ${subtitle ? `<div class="match-sub">${subtitle}</div>` : ``}
      </div>
      <div class="match-b">
        ${teams.join("")}
      </div>
    </div>
  `;
}

function roundCol(roundTitle, cardsHtml) {
  return `
    <div class="round">
      <div class="round-title">${roundTitle}</div>
      <div class="round-cards">
        ${cardsHtml}
      </div>
    </div>
  `;
}

function qCurvePath(x1, y1, x2, y2) {
  // Nice gentle curve (horizontal bracket)
  const mx = (x1 + x2) / 2;
  return `M ${x1} ${y1} Q ${mx} ${y1} ${mx} ${(y1 + y2) / 2} T ${x2} ${y2}`;
}

function drawLines(connections) {
  const wrap = document.querySelector(".bracket-wrap");
  const svg = document.getElementById("bracketLines");
  const bracket = document.getElementById("bracket");
  if (!wrap || !svg || !bracket) return;

  // Make the SVG cover the scrollable content area so lines move with horizontal scroll.
  const w = bracket.scrollWidth;
  const h = bracket.getBoundingClientRect().height;
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  // Clear
  svg.innerHTML = "";

  // styling (inline so it works anywhere)
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <linearGradient id="dodLine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="rgba(245,166,35,0.55)"/>
      <stop offset="1" stop-color="rgba(99,102,241,0.45)"/>
    </linearGradient>
    <filter id="dodGlow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="2.2" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  `;
  svg.appendChild(defs);

  const wrapRect = bracket.getBoundingClientRect();

  for (const { fromMatchId, toMatchId } of connections) {
    const from = bracket.querySelector(`.match[data-match-id="${fromMatchId}"]`);
    const to = bracket.querySelector(`.match[data-match-id="${toMatchId}"]`);
    if (!from || !to) continue;

    const fr = from.getBoundingClientRect();
    const tr = to.getBoundingClientRect();

    // Coordinates relative to the bracket content (not viewport)
    const x1 = (fr.right - wrapRect.left) + bracket.scrollLeft - 10;
    const y1 = (fr.top + fr.height / 2) - wrapRect.top;
    const x2 = (tr.left - wrapRect.left) + bracket.scrollLeft + 10;
    const y2 = (tr.top + tr.height / 2) - wrapRect.top;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", qCurvePath(x1, y1, x2, y2));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "url(#dodLine)");
    path.setAttribute("stroke-width", "3");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("filter", "url(#dodGlow)");
    path.setAttribute("opacity", "0.9");
    svg.appendChild(path);
  }
}

function renderBracket(seeded, picks) {
  // seeded: [{seed, name}]
  const s = {};
  seeded.forEach(x => (s[x.seed] = x.name));

  // Format requested interpreted as a standard bracket:
  // Play-in: (5 vs 6) and (3 vs 4)
  // Semi: 1 vs W(5/6) and 2 vs W(3/4)
  // Final: winners
  //
  // Match IDs:
  // m1: 5v6, m2: 3v4, m3: 1vW1, m4: 2vW2, m5: final

  const matchTeams = {};
  const chosen = picks || {};

  const m1Teams = [
    { seed: 5, name: s[5] || "TBD" },
    { seed: 6, name: s[6] || "TBD" }
  ];
  const m2Teams = [
    { seed: 3, name: s[3] || "TBD" },
    { seed: 4, name: s[4] || "TBD" }
  ];

  // winners (seed numbers) from picks:
  const w1Seed = chosen.m1 ? Number(chosen.m1) : null;
  const w2Seed = chosen.m2 ? Number(chosen.m2) : null;

  const w1Name = w1Seed ? (s[w1Seed] || "TBD") : "W(5 vs 6)";
  const w2Name = w2Seed ? (s[w2Seed] || "TBD") : "W(3 vs 4)";

  const m3Teams = [
    { seed: 1, name: s[1] || "TBD" },
    { seed: w1Seed ? w1Seed : "W1", name: w1Name }
  ];
  const m4Teams = [
    { seed: 2, name: s[2] || "TBD" },
    { seed: w2Seed ? w2Seed : "W2", name: w2Name }
  ];

  const w3Seed = chosen.m3 ? chosen.m3 : null;
  const w4Seed = chosen.m4 ? chosen.m4 : null;

  const w3Name = w3Seed ? (s[Number(w3Seed)] || "TBD") : "W(Semi A)";
  const w4Name = w4Seed ? (s[Number(w4Seed)] || "TBD") : "W(Semi B)";

  const m5Teams = [
    { seed: w3Seed ? Number(w3Seed) : "WA", name: w3Name },
    { seed: w4Seed ? Number(w4Seed) : "WB", name: w4Name }
  ];

  matchTeams.m1 = m1Teams;
  matchTeams.m2 = m2Teams;
  matchTeams.m3 = m3Teams;
  matchTeams.m4 = m4Teams;
  matchTeams.m5 = m5Teams;

  // Determine which matches are currently pickable
  const isRealTeam = (t) => typeof t.seed === "number" && t.name && t.name !== "TBD";
  const matchPickable = {
    m1: m1Teams.every(isRealTeam),
    m2: m2Teams.every(isRealTeam),
    m3: isRealTeam(m3Teams[0]) && isRealTeam(m3Teams[1]) && (w1Seed !== null),
    m4: isRealTeam(m4Teams[0]) && isRealTeam(m4Teams[1]) && (w2Seed !== null),
    m5: isRealTeam(m5Teams[0]) && isRealTeam(m5Teams[1]) && (w3Seed !== null) && (w4Seed !== null)
  };

  // Build HTML
  const playIns =
    matchCard({
      matchId: "m1",
      title: "Play‑In A",
      subtitle: "5 vs 6",
      teams: m1Teams.map(t => teamRow({
        matchId: "m1",
        seed: t.seed,
        name: t.name,
        selected: String(chosen.m1) === String(t.seed),
        disabled: !matchPickable.m1
      }))
    }) +
    matchCard({
      matchId: "m2",
      title: "Play‑In B",
      subtitle: "3 vs 4",
      teams: m2Teams.map(t => teamRow({
        matchId: "m2",
        seed: t.seed,
        name: t.name,
        selected: String(chosen.m2) === String(t.seed),
        disabled: !matchPickable.m2
      }))
    });

  const semis =
    matchCard({
      matchId: "m3",
      title: "Semifinal A",
      subtitle: "1 vs W(5/6)",
      teams: m3Teams.map(t => teamRow({
        matchId: "m3",
        seed: t.seed,
        name: t.name,
        selected: String(chosen.m3) === String(t.seed),
        disabled: !matchPickable.m3 || !isRealTeam(t)
      }))
    }) +
    matchCard({
      matchId: "m4",
      title: "Semifinal B",
      subtitle: "2 vs W(3/4)",
      teams: m4Teams.map(t => teamRow({
        matchId: "m4",
        seed: t.seed,
        name: t.name,
        selected: String(chosen.m4) === String(t.seed),
        disabled: !matchPickable.m4 || !isRealTeam(t)
      }))
    });

  const final =
    matchCard({
      matchId: "m5",
      title: "Championship",
      subtitle: "🏆",
      teams: m5Teams.map(t => teamRow({
        matchId: "m5",
        seed: t.seed,
        name: t.name,
        selected: String(chosen.m5) === String(t.seed),
        disabled: !matchPickable.m5 || !isRealTeam(t)
      }))
    });

  const bracketHtml =
    roundCol("Play‑Ins", playIns) +
    roundCol("Semifinals", semis) +
    roundCol("Final", final);

  const el = document.getElementById("bracket");
  if (el) el.innerHTML = bracketHtml;

  // Draw lines (after DOM paint)
  const connections = [
    { fromMatchId: "m1", toMatchId: "m3" },
    { fromMatchId: "m2", toMatchId: "m4" },
    { fromMatchId: "m3", toMatchId: "m5" },
    { fromMatchId: "m4", toMatchId: "m5" }
  ];

  requestAnimationFrame(() => {
    drawLines(connections);
  });

  return matchTeams;
}

function reconcileDownstream(picks, matchTeams) {
  // If a prior winner changes, invalidate downstream picks that aren't possible anymore.
  const p = { ...(picks || {}) };

  const m3Seeds = (matchTeams.m3 || []).map(t => String(t.seed));
  const m4Seeds = (matchTeams.m4 || []).map(t => String(t.seed));
  const m5Seeds = (matchTeams.m5 || []).map(t => String(t.seed));

  if (p.m3 && !m3Seeds.includes(String(p.m3))) delete p.m3;
  if (p.m4 && !m4Seeds.includes(String(p.m4))) delete p.m4;
  if (p.m5 && !m5Seeds.includes(String(p.m5))) delete p.m5;

  return p;
}

async function load() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();

    const stats = {};

    // Initialize active players
    data.players.forEach(p => {
      if (String(p.active).toLowerCase() === "false") return;

      stats[p.player_id] = {
        name: p.name,
        wins: Number(p.starting_wins || 0),
        games: Number(p.starting_games || 0)
      };
    });

    // Process games
    (data.games || []).forEach(g => {
      const winner = g.winner_id;

      (g.player_ids || []).forEach(pid => {
        if (stats[pid]) stats[pid].games += 1;
      });

      if (stats[winner]) stats[winner].wins += 1;
    });

    // Rank
    const rows = Object.values(stats).map(s => ({
      name: s.name,
      wins: s.wins,
      games: s.games,
      points: s.wins * 2,
      winPct: pct(s.wins, s.games)
    }));

    rows.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.winPct !== a.winPct) return b.winPct - a.winPct;
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.games - a.games;
    });

    const top6 = rows.slice(0, 6).map((r, i) => ({ seed: i + 1, name: r.name }));

    // Picks + validation
    const matchTeamsById = {
      m1: [{ seed: 5, name: top6[4]?.name }, { seed: 6, name: top6[5]?.name }],
      m2: [{ seed: 3, name: top6[2]?.name }, { seed: 4, name: top6[3]?.name }],
      m3: [{ seed: 1, name: top6[0]?.name }], // opponent depends on m1
      m4: [{ seed: 2, name: top6[1]?.name }],
      m5: []
    };

    let picks = clearInvalidPicks(getPicks(), matchTeamsById);

    // Initial render, then reconcile and rerender if needed
    let mt = renderBracket(top6, picks);
    picks = reconcileDownstream(picks, mt);
    savePicks(picks);
    mt = renderBracket(top6, picks);

    // Interaction: click / keyboard
    const bracketEl = document.getElementById("bracket");
    if (bracketEl && !bracketEl.dataset.bound) {
      bracketEl.dataset.bound = "true";

      const activate = (target) => {
        const team = target.closest(".team");
        if (!team) return;
        if (team.classList.contains("disabled")) return;

        const matchId = team.getAttribute("data-match");
        const seed = team.getAttribute("data-seed");
        if (!matchId || !seed) return;

        const current = getPicks();
        const next = { ...current, [matchId]: seed };

        // If you change an upstream pick, clear downstream picks to avoid weird states.
        if (matchId === "m1") { delete next.m3; delete next.m5; }
        if (matchId === "m2") { delete next.m4; delete next.m5; }
        if (matchId === "m3") { delete next.m5; }
        if (matchId === "m4") { delete next.m5; }

        savePicks(next);

        // Re-render immediately using current top6
        const mt2 = renderBracket(top6, next);
        const fixed = reconcileDownstream(next, mt2);
        savePicks(fixed);
        renderBracket(top6, fixed);
      };

      bracketEl.addEventListener("click", (e) => activate(e.target));
      bracketEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          activate(e.target);
          e.preventDefault();
        }
      });

      // Recompute lines on resize + scroll
      window.addEventListener("resize", () => {
        // small debounce
        clearTimeout(window.__dodLineT);
        window.__dodLineT = setTimeout(() => {
          renderBracket(top6, getPicks());
        }, 60);
      });

      bracketEl.addEventListener("scroll", () => {
        // redraw lines on scroll so they track
        clearTimeout(window.__dodScrollT);
        window.__dodScrollT = setTimeout(() => {
          renderBracket(top6, getPicks());
        }, 20);
      }, { passive: true });
    }

    const updated = document.getElementById("updated");
    if (updated) updated.textContent = "Last updated: " + new Date().toLocaleString();

  } catch (err) {
    console.error(err);
    const updated = document.getElementById("updated");
    if (updated) updated.textContent = "Failed to load data";
  }
}

load();
setInterval(load, 30000);
