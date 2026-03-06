const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";
const PICKS_KEY = "dod_playoffs_picks_v3";

function points(wins) {
  return Number(wins || 0) * 2;
}

function pctNumber(wins, games) {
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
  if (b.points !== a.points) return b.points - a.points;
  if (b.winPct !== a.winPct) return b.winPct - a.winPct;
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.games !== a.games) return b.games - a.games;
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

  (data.players || []).forEach(p => {
    if (String(p.active).toLowerCase() === "false") return;
    stats[p.player_id] = {
      id: p.player_id,
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  (data.games || []).forEach(g => {
    const ids = (g.player_ids || []).map(String);
    ids.forEach(pid => {
      if (stats[pid]) stats[pid].games += 1;
    });

    const winner = String(g.winner_id || "");
    if (stats[winner]) stats[winner].wins += 1;
  });

  const rows = Object.values(stats).map(s => ({
    ...s,
    points: points(s.wins),
    winPct: pctNumber(s.wins, s.games)
  }));

  rows.sort(byStandings);
  return rows;
}

function seedsFromStandings(standings) {
  const top6 = standings.slice(0, 6);
  const seedById = new Map();
  top6.forEach((p, i) => seedById.set(String(p.id), i + 1));
  return { top6, seedById };
}

function normalizePicks(picks, validIds) {
  const out = {
    semiWinners: {},
    playInWinner: null,
    champion: null,
  };

  ["semi1", "semi2"].forEach(key => {
    const val = picks?.semiWinners?.[key];
    if (val && validIds.has(String(val))) out.semiWinners[key] = String(val);
  });

  if (picks?.playInWinner && validIds.has(String(picks.playInWinner))) {
    out.playInWinner = String(picks.playInWinner);
  }

  if (picks?.champion && validIds.has(String(picks.champion))) {
    out.champion = String(picks.champion);
  }

  return out;
}

function drawConnector(svg, fromEl, toEl, opts = {}) {
  if (!svg || !fromEl || !toEl) return;

  const s = svg.getBoundingClientRect();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();

  const x1 = (a.right - s.left);
  const y1 = (a.top + a.height / 2 - s.top);
  const x2 = (b.left - s.left);
  const y2 = (b.top + b.height / 2 - s.top);
  const dx = Math.max(56, (x2 - x1) * 0.48);

  const d = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;

  const glow = document.createElementNS("http://www.w3.org/2000/svg", "path");
  glow.setAttribute("d", d);
  glow.setAttribute("fill", "none");
  glow.setAttribute("stroke", opts.glow || "rgba(99,102,241,0.25)");
  glow.setAttribute("stroke-width", opts.glowWidth || "10");
  glow.setAttribute("stroke-linecap", "round");
  svg.appendChild(glow);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", opts.stroke || "rgba(245,166,35,0.65)");
  path.setAttribute("stroke-width", opts.width || "2.5");
  path.setAttribute("stroke-linecap", "round");
  svg.appendChild(path);
}

function redrawLines() {
  const svg = document.getElementById("bracketLines");
  const wrap = document.querySelector(".bracket-wrap");
  if (!svg || !wrap) return;

  svg.innerHTML = "";
  const rect = wrap.getBoundingClientRect();
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  svg.setAttribute("preserveAspectRatio", "none");

  const semi1 = document.getElementById("match-semi1");
  const semi2 = document.getElementById("match-semi2");
  const playin = document.getElementById("match-playin");
  const finals = document.getElementById("match-finals");

  drawConnector(svg, semi1, playin, { stroke: "rgba(56,189,248,0.55)", glow: "rgba(56,189,248,0.18)" });
  drawConnector(svg, semi2, playin, { stroke: "rgba(56,189,248,0.55)", glow: "rgba(56,189,248,0.18)" });
  drawConnector(svg, semi1, finals, { stroke: "rgba(245,166,35,0.55)", glow: "rgba(245,166,35,0.16)" });
  drawConnector(svg, semi2, finals, { stroke: "rgba(245,166,35,0.55)", glow: "rgba(245,166,35,0.16)" });
  drawConnector(svg, playin, finals, { stroke: "rgba(168,85,247,0.65)", glow: "rgba(168,85,247,0.22)" });
}

function renderTeamRow(player, seed, state, onClick, opts = {}) {
  const id = player ? String(player.id) : "";
  const disabled = !!opts.disabled;
  const clickable = !!opts.clickable && !disabled;
  const selected = !!opts.selected;
  const crowned = !!opts.crowned;

  const row = el("div", {
    class: [
      "team",
      selected ? "selected" : "",
      crowned ? "crowned" : "",
      disabled ? "disabled" : "",
      opts.variant ? `team-${opts.variant}` : "",
    ].filter(Boolean).join(" "),
    role: clickable ? "button" : "group",
    tabindex: clickable ? "0" : "-1",
    "data-id": id
  });

  const left = el("div", { class: "left" }, [
    el("span", { class: "seed" }, seed ? `SEED ${seed}` : (opts.label || "")),
    el("span", { class: "name" }, player ? player.name : (opts.placeholder || "TBD"))
  ]);

  const badgeText = crowned ? "👑" : (opts.badge || "");
  const badge = el("span", { class: "pick", title: badgeText || "" }, badgeText);

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

function renderBracket({ semi1, semi2, seedById }) {
  const bracket = document.getElementById("bracket");
  if (!bracket) return;

  const allPlayers = [...semi1, ...semi2];
  const validIds = new Set(allPlayers.map(p => String(p.id)));
  let picks = normalizePicks(getPicks(), validIds);

  function semiLosers() {
    return allPlayers.filter(p => {
      const sid = String(p.id);
      return sid !== picks.semiWinners.semi1 && sid !== picks.semiWinners.semi2;
    });
  }

  function finalPlayers() {
    return [picks.semiWinners.semi1, picks.semiWinners.semi2, picks.playInWinner]
      .map(id => allPlayers.find(p => String(p.id) === String(id)))
      .filter(Boolean);
  }

  function cleanPicks(next) {
    const normalized = normalizePicks(next, validIds);
    const loserIds = new Set(semiLosers().map(p => String(p.id)));

    if (normalized.playInWinner && !loserIds.has(normalized.playInWinner)) {
      normalized.playInWinner = null;
    }

    const finalIds = new Set([
      normalized.semiWinners.semi1,
      normalized.semiWinners.semi2,
      normalized.playInWinner
    ].filter(Boolean));

    if (normalized.champion && !finalIds.has(normalized.champion)) {
      normalized.champion = null;
    }

    return normalized;
  }

  function setPicks(next) {
    picks = cleanPicks(next);
    savePicks(picks);
  }

  function pickSemi(matchKey, id) {
    const sid = String(id);
    const next = {
      ...picks,
      semiWinners: { ...picks.semiWinners, [matchKey]: picks.semiWinners[matchKey] === sid ? null : sid }
    };
    if (next.semiWinners[matchKey] === null) delete next.semiWinners[matchKey];
    setPicks(next);
    paint();
  }

  function pickPlayIn(id) {
    const sid = String(id);
    const losers = semiLosers().map(p => String(p.id));
    if (!losers.includes(sid)) return;
    setPicks({ ...picks, playInWinner: picks.playInWinner === sid ? null : sid });
    paint();
  }

  function pickChampion(id) {
    const sid = String(id);
    const finals = finalPlayers().map(p => String(p.id));
    if (!finals.includes(sid)) return;
    setPicks({ ...picks, champion: picks.champion === sid ? null : sid });
    paint();
  }

  function resetAll() {
    setPicks({ semiWinners: {}, playInWinner: null, champion: null });
    paint();
  }

  function buildRound(title, matchEl, meta) {
    return el("div", { class: "round" }, [
      el("div", { class: "round-title" }, title),
      meta ? el("div", { class: "round-meta" }, meta) : null,
      el("div", { class: "round-cards" }, [matchEl]),
    ]);
  }

  function buildMatch({ id, stage, title, subtitle, teams, onPick, selectedIds, championId }) {
    const body = el("div", { class: "match-b" });

    teams.forEach(t => {
      body.appendChild(renderTeamRow(
        t.player || null,
        t.seed || null,
        picks,
        onPick || (() => {}),
        {
          clickable: !!(onPick && t.player),
          disabled: !!t.disabled,
          placeholder: t.placeholder,
          label: t.label,
          selected: !!(t.player && selectedIds.includes(String(t.player.id))),
          crowned: !!(t.player && championId && championId === String(t.player.id)),
          badge: t.badge,
          variant: stage,
        }
      ));
    });

    return el("div", { class: `match stage-${stage}`, id }, [
      el("div", { class: "match-h" }, [
        el("div", { class: "match-title-wrap" }, [
          el("div", { class: "match-eyebrow" }, stage.toUpperCase()),
          el("div", { class: "match-title" }, title),
        ]),
        el("span", { class: "match-sub" }, subtitle || "")
      ]),
      body
    ]);
  }

  function paint() {
    bracket.innerHTML = "";

    const semi1Winner = picks.semiWinners.semi1;
    const semi2Winner = picks.semiWinners.semi2;
    const losers = semiLosers();
    const losersReady = !!semi1Winner && !!semi2Winner;
    const finalsReady = !!semi1Winner && !!semi2Winner && !!picks.playInWinner;

    const semi1Match = buildMatch({
      id: "match-semi1",
      stage: "semi",
      title: "Semifinal 1",
      subtitle: "Seeds 1, 5, 6 · Best of 4",
      teams: semi1.map(p => ({ player: p, seed: seedById.get(String(p.id)) })),
      onPick: (id) => pickSemi("semi1", id),
      selectedIds: [semi1Winner],
      championId: null,
    });

    const semi2Match = buildMatch({
      id: "match-semi2",
      stage: "semi",
      title: "Semifinal 2",
      subtitle: "Seeds 2, 3, 4 · Best of 4",
      teams: semi2.map(p => ({ player: p, seed: seedById.get(String(p.id)) })),
      onPick: (id) => pickSemi("semi2", id),
      selectedIds: [semi2Winner],
      championId: null,
    });

    const playInTeams = losersReady
      ? losers.map(p => ({ player: p, seed: seedById.get(String(p.id)) }))
      : [
          { placeholder: "Waiting for semifinal winner", label: "LOSER SLOT" },
          { placeholder: "Waiting for semifinal winner", label: "LOSER SLOT" },
          { placeholder: "Waiting for semifinal winner", label: "LOSER SLOT" },
          { placeholder: "Waiting for semifinal winner", label: "LOSER SLOT" },
        ];

    const playInMatch = buildMatch({
      id: "match-playin",
      stage: "playin",
      title: "Play-In",
      subtitle: "4-player game · 1 advances",
      teams: playInTeams,
      onPick: losersReady ? pickPlayIn : null,
      selectedIds: picks.playInWinner ? [picks.playInWinner] : [],
      championId: null,
    });

    const finalsTeams = finalsReady
      ? finalPlayers().map(p => ({ player: p, seed: seedById.get(String(p.id)), badge: "●" }))
      : [
          { placeholder: "Winner of Semifinal 1", label: "FINALIST" },
          { placeholder: "Winner of Semifinal 2", label: "FINALIST" },
          { placeholder: "Winner of Play-In", label: "FINALIST" },
        ];

    const finalsMatch = buildMatch({
      id: "match-finals",
      stage: "finals",
      title: "Finals",
      subtitle: "3-player final · Best of 3",
      teams: finalsTeams,
      onPick: finalsReady ? pickChampion : null,
      selectedIds: picks.champion ? [picks.champion] : [],
      championId: picks.champion,
    });

    const hero = el("div", { class: "playoff-hero" }, [
      el("div", { class: "playoff-hero__badge" }, "🏆 Championship Path"),
      el("div", { class: "playoff-hero__title" }, "Six get in. Two semifinal battles. One last shot. One champion."),
      el("div", { class: "playoff-hero__meta" }, [
        el("span", { class: "hero-pill" }, "Semifinals: Best of 4"),
        el("span", { class: "hero-pill" }, "Play-In: 1 Game"),
        el("span", { class: "hero-pill" }, "Finals: Best of 3"),
      ])
    ]);

    const controls = el("div", { class: "bracket-controls" }, [
      el("div", { class: "bracket-hint" }, "Click a semifinal winner in each group, then pick the Play-In survivor, then crown your finals winner."),
      el("button", { class: "btn small", type: "button", onclick: resetAll }, "Reset bracket")
    ]);

    bracket.appendChild(hero);
    bracket.appendChild(el("div", { class: "bracket-grid" }, [
      buildRound("SEMIFINAL 1", semi1Match, "3-player series"),
      buildRound("SEMIFINAL 2", semi2Match, "3-player series"),
      buildRound("PLAY-IN", playInMatch, "Four semifinal non-winners battle for the last seat"),
      buildRound("FINALS", finalsMatch, "Three-player series for the title"),
    ]));
    bracket.appendChild(controls);

    requestAnimationFrame(redrawLines);
  }

  paint();
  window.addEventListener("resize", () => redrawLines(), { passive: true });
  setTimeout(() => redrawLines(), 350);
}

async function loadPlayoffs() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();

    setUpdated(data.updated ? `Last updated: ${data.updated}` : "");

    const standings = computeStandings(data);
    const { top6, seedById } = seedsFromStandings(standings);

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
