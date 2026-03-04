// Uses the same data feed as the Standings page
const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";

// Browser persistence for *this device* only
const PICKS_KEY = "dod_playoffs_picks_v2";

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

function byStandings(a, b) {
  // sort desc by win%, then wins, then name
  const pa = pct(a.wins, a.games);
  const pb = pct(b.wins, b.games);
  if (pb !== pa) return pb - pa;
  if (b.wins !== a.wins) return b.wins - a.wins;
  return String(a.name).localeCompare(String(b.name));
}

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c === null || c === undefined) return;
    if (typeof c === "string") n.appendChild(document.createTextNode(c));
    else n.appendChild(c);
  });
  return n;
}

function setUpdated(text) {
  const n = document.getElementById("updated");
  if (n) n.textContent = text || "";
}

function computeStandings(data) {
  const stats = {};

  // initialize players
  (data.players || []).forEach(p => {
    if (String(p.active).toLowerCase() === "false") return;
    stats[p.player_id] = {
      id: p.player_id,
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  // roll up games
  (data.games || []).forEach(g => {
    const p1 = g.p1_id, p2 = g.p2_id, w = g.winner_id;
    if (!stats[p1] || !stats[p2]) return;

    stats[p1].games += 1;
    stats[p2].games += 1;

    if (String(w) === String(p1)) stats[p1].wins += 1;
    else if (String(w) === String(p2)) stats[p2].wins += 1;
  });

  const arr = Object.values(stats);
  arr.sort(byStandings);
  return arr;
}

function seedsFromStandings(standings) {
  const top6 = standings.slice(0, 6);
  const seedById = new Map();
  top6.forEach((p, i) => seedById.set(String(p.id), i + 1));
  return { top6, seedById };
}

function drawConnector(svg, fromEl, toEl) {
  if (!svg || !fromEl || !toEl) return;

  const s = svg.getBoundingClientRect();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();

  const x1 = (a.right - s.left);
  const y1 = (a.top + a.height / 2 - s.top);
  const x2 = (b.left - s.left);
  const y2 = (b.top + b.height / 2 - s.top);

  const dx = Math.max(40, (x2 - x1) * 0.55);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "rgba(245,166,35,0.55)");
  path.setAttribute("stroke-width", "2.2");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("opacity", "0.9");
  svg.appendChild(path);

  const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  glow.setAttribute("d", path.getAttribute("d"));
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", "rgba(99,102,241,0.30)");
  glow.setAttribute("stroke-width", "7");
  glow.setAttribute("stroke-linecap", "round");
  glow.setAttribute("opacity", "0.55");
  svg.appendChild(glow);
}

function redrawLines() {
  const svg = document.getElementById("bracketLines");
  if (!svg) return;
  svg.innerHTML = "";
  const wrap = document.querySelector(".bracket-wrap");
  if (!wrap) return;

  const rect = wrap.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const semi1 = document.getElementById("match-semi1");
  const semi2 = document.getElementById("match-semi2");
  const finals = document.getElementById("match-finals");

  drawConnector(svg, semi1, finals);
  drawConnector(svg, semi2, finals);
}

function renderTeamRow(player, seed, picks, onClick, opts = {}) {
  const id = player ? String(player.id) : "";
  const pickIndex = picks.finalists.indexOf(id);
  const isFinalist = pickIndex !== -1;
  const isChampion = picks.champion && String(picks.champion) === id;

  const disabled = !!opts.disabled;
  const clickable = !!opts.clickable && !disabled;

  const row = el("div", {
    class: [
      "team",
      isFinalist ? "selected" : "",
      disabled ? "disabled" : ""
    ].filter(Boolean).join(" "),
    role: clickable ? "button" : "group",
    tabindex: clickable ? "0" : "-1",
    "data-id": id
  });

  const left = el("div", { class: "left" }, [
    el("span", { class: "seed" }, seed ? `SEED ${seed}` : opts.label || ""),
    el("span", { class: "name" }, player ? player.name : (opts.placeholder || "TBD"))
  ]);

  // pick badge: finalist order or champion crown
  let badge = null;
  if (isChampion) {
    badge = el("span", { class: "pick", title: "Champion" }, "👑");
  } else if (isFinalist) {
    badge = el("span", { class: "pick", title: "Finalist order" }, String(pickIndex + 1));
  } else if (opts.showEmptyPick) {
    badge = el("span", { class: "pick", title: "Pick" }, "•");
  } else {
    badge = el("span", { class: "pick", title: "" }, "");
  }

  row.appendChild(left);
  row.appendChild(badge);

  if (clickable) {
    const handler = () => onClick(id);
    row.addEventListener("click", handler);
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handler(); }
    });
  }

  return row;
}

function normalizePicks(picks, validIds) {
  const out = { finalists: [], champion: null };

  const seen = new Set();
  (picks.finalists || []).forEach(id => {
    const sid = String(id);
    if (!validIds.has(sid)) return;
    if (seen.has(sid)) return;
    seen.add(sid);
    out.finalists.push(sid);
  });

  out.finalists = out.finalists.slice(0, 3);

  if (picks.champion && validIds.has(String(picks.champion)) && out.finalists.includes(String(picks.champion))) {
    out.champion = String(picks.champion);
  } else {
    out.champion = null;
  }

  return out;
}

function renderBracket({ semi1, semi2, seedById }) {
  const bracket = document.getElementById("bracket");
  if (!bracket) return;

  const validIds = new Set([...semi1, ...semi2].map(p => String(p.id)));
  let picks = normalizePicks(getPicks(), validIds);

  function setPicks(next) {
    picks = normalizePicks(next, validIds);
    savePicks(picks);
  }

  function toggleFinalist(id) {
    const sid = String(id);
    const next = { ...picks, finalists: [...picks.finalists] };
    const idx = next.finalists.indexOf(sid);

    if (idx !== -1) {
      next.finalists.splice(idx, 1);
      if (next.champion === sid) next.champion = null;
    } else {
      if (next.finalists.length >= 3) return; // max 3 finalists
      next.finalists.push(sid);
    }

    setPicks(next);
    paint();
  }

  function pickChampion(id) {
    const sid = String(id);
    if (!picks.finalists.includes(sid)) return;
    const next = { ...picks, champion: picks.champion === sid ? null : sid };
    setPicks(next);
    paint();
  }

  function resetAll() {
    setPicks({ finalists: [], champion: null });
    paint();
  }

  function buildRound(title, matchEl) {
    return el("div", { class: "round" }, [
      el("div", { class: "round-title" }, title),
      el("div", { class: "round-cards" }, [matchEl]),
    ]);
  }

  function buildMatch({ id, title, subtitle, teams, clickMode }) {
    // clickMode: "finalists" | "champion" | null
    const body = el("div", { class: "match-b" });

    teams.forEach(t => {
      if (t.player) {
        body.appendChild(renderTeamRow(
          t.player,
          t.seed,
          picks,
          clickMode === "finalists" ? toggleFinalist : pickChampion,
          { clickable: !!clickMode }
        ));
      } else {
        body.appendChild(renderTeamRow(
          null,
          null,
          picks,
          () => {},
          { disabled: true, placeholder: t.placeholder || "TBD", label: t.label || "FINALIST" }
        ));
      }
    });

    const headerRight = el("span", { class: "match-sub" }, subtitle || "");

    const header = el("div", { class: "match-h" }, [
      el("div", { class: "match-title" }, title),
      headerRight
    ]);

    const match = el("div", { class: "match", id }, [header, body]);

    return match;
  }

  function paint() {
    bracket.innerHTML = "";

    const semi1Match = buildMatch({
      id: "match-semi1",
      title: "Semifinal 1",
      subtitle: "3‑player game",
      teams: semi1.map(p => ({ player: p, seed: seedById.get(String(p.id)) })),
      clickMode: "finalists"
    });

    const semi2Match = buildMatch({
      id: "match-semi2",
      title: "Semifinal 2",
      subtitle: "3‑player game",
      teams: semi2.map(p => ({ player: p, seed: seedById.get(String(p.id)) })),
      clickMode: "finalists"
    });

    const finalists = picks.finalists
      .map(id => [...semi1, ...semi2].find(p => String(p.id) === String(id)))
      .filter(Boolean);

    const finalsTeams = [];
    for (let i = 0; i < 3; i++) {
      if (finalists[i]) finalsTeams.push({ player: finalists[i], seed: seedById.get(String(finalists[i].id)) });
      else finalsTeams.push({ placeholder: "Select from semifinals", label: `FINALIST ${i + 1}` });
    }

    const finalsMatch = buildMatch({
      id: "match-finals",
      title: "Finals",
      subtitle: "Top 3 advance",
      teams: finalsTeams,
      clickMode: "champion"
    });

    const controls = el("div", { class: "bracket-controls" }, [
      el("div", { class: "bracket-hint" }, "Click players in the semifinals to choose the 3 finalists. Then click a finalist to crown the champion."),
      el("button", { class: "btn small", type: "button", onclick: resetAll }, "Reset picks")
    ]);

    bracket.appendChild(buildRound("SEMIFINAL 1", semi1Match));
    bracket.appendChild(buildRound("SEMIFINAL 2", semi2Match));
    bracket.appendChild(buildRound("FINALS", finalsMatch));
    bracket.appendChild(controls);

    // lines after layout
    requestAnimationFrame(() => {
      redrawLines();
    });
  }

  paint();

  window.addEventListener("resize", () => redrawLines(), { passive: true });
  // If fonts load late, redraw once more
  setTimeout(() => redrawLines(), 350);
}

async function loadPlayoffs() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();

    setUpdated(data.updated ? `Last updated: ${data.updated}` : "");

    const standings = computeStandings(data);
    const { top6, seedById } = seedsFromStandings(standings);

    // Seed groups requested:
    // Semifinal 1: seeds 1,5,6
    // Semifinal 2: seeds 2,3,4
    const bySeed = new Map();
    top6.forEach(p => bySeed.set(seedById.get(String(p.id)), p));

    const semi1 = [bySeed.get(1), bySeed.get(5), bySeed.get(6)].filter(Boolean);
    const semi2 = [bySeed.get(2), bySeed.get(3), bySeed.get(4)].filter(Boolean);

    renderBracket({ semi1, semi2, seedById });

  } catch (e) {
    console.error(e);
    setUpdated("Could not load data.");
    const bracket = document.getElementById("bracket");
    if (bracket) bracket.innerHTML = `<div class="card">Error loading bracket.</div>`;
  }
}

loadPlayoffs();
