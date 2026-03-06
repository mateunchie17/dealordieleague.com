const DATA_URL = "https://script.google.com/macros/s/AKfycbxQrUIzOHVOcEQuvA1Yq61SK3ATgj7DORlSfn-kDMaAUGjujrrjwqP5BtMx5uflmCDsRA/exec";
const PICKS_KEY = "dod_playoffs_picks_v3";

function pctValue(wins, games) {
  if (!games) return 0;
  return Number(((wins / games) * 100).toFixed(1));
}

function getPicks() {
  try {
    return JSON.parse(localStorage.getItem(PICKS_KEY) || '{}');
  } catch {
    return {};
  }
}

function savePicks(picks) {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify(picks || {}));
  } catch {}
}

function setUpdated(text) {
  const n = document.getElementById('updated');
  if (n) n.textContent = text || '';
}

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (child === null || child === undefined) return;
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  });
  return node;
}

function computeStandings(data) {
  const stats = {};

  (data.players || []).forEach((p) => {
    if (String(p.active).toLowerCase() === 'false') return;
    stats[p.player_id] = {
      id: p.player_id,
      name: p.name,
      wins: Number(p.starting_wins || 0),
      games: Number(p.starting_games || 0),
    };
  });

  (data.games || []).forEach((g) => {
    (g.player_ids || []).forEach((pid) => {
      if (stats[pid]) stats[pid].games += 1;
    });
    if (stats[g.winner_id]) stats[g.winner_id].wins += 1;
  });

  const rows = Object.values(stats).map((s) => ({
    ...s,
    points: s.wins * 2,
    winPct: pctValue(s.wins, s.games),
  }));

  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.winPct !== a.winPct) return b.winPct - a.winPct;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return b.games - a.games;
  });

  let currentRank = 0;
  let lastPoints = null;
  let lastPct = null;
  rows.forEach((r, i) => {
    if (r.points !== lastPoints || r.winPct !== lastPct) {
      currentRank = i + 1;
      lastPoints = r.points;
      lastPct = r.winPct;
    }
    r.rank = currentRank;
  });

  return rows;
}

function seedsFromStandings(standings) {
  const playoffPool = standings.filter((p) => p.rank <= 6);
  const topSix = playoffPool.slice(0, 6);
  const seedById = new Map();
  topSix.forEach((p, i) => seedById.set(String(p.id), i + 1));
  return { topSix, playoffPool, seedById };
}

function normalizePicks(picks, groups) {
  const validSemi1 = new Set(groups.semi1.map((p) => String(p.id)));
  const validSemi2 = new Set(groups.semi2.map((p) => String(p.id)));
  const validPlayIn = new Set(groups.playIn.map((p) => String(p.id)));
  const finalsAllowed = new Set([...groups.finals.map((p) => String(p.id))]);

  const out = {
    semi1Winner: validSemi1.has(String(picks.semi1Winner || '')) ? String(picks.semi1Winner) : null,
    semi2Winner: validSemi2.has(String(picks.semi2Winner || '')) ? String(picks.semi2Winner) : null,
    playInWinner: validPlayIn.has(String(picks.playInWinner || '')) ? String(picks.playInWinner) : null,
    champion: finalsAllowed.has(String(picks.champion || '')) ? String(picks.champion) : null,
  };

  if (out.champion && ![out.semi1Winner, out.semi2Winner, out.playInWinner].includes(out.champion)) {
    out.champion = null;
  }

  return out;
}

function renderTeamRow(player, seed, options = {}) {
  const id = player ? String(player.id) : '';
  const row = el('div', {
    class: [
      'team',
      options.selected ? 'selected' : '',
      options.winner ? 'winner' : '',
      options.champion ? 'champion' : '',
      options.clickable ? 'clickable' : '',
      options.disabled ? 'disabled' : ''
    ].filter(Boolean).join(' '),
    role: options.clickable ? 'button' : 'group',
    tabindex: options.clickable ? '0' : '-1',
    'data-id': id
  });

  const left = el('div', { class: 'left' }, [
    el('span', { class: 'seed' }, seed ? `Seed ${seed}` : (options.label || 'TBD')),
    el('span', { class: 'name' }, player ? player.name : (options.placeholder || 'TBD')),
  ]);

  const badgeText = options.champion ? '👑' : options.winner ? 'WIN' : options.showDot ? '•' : '';
  const badge = el('span', { class: 'pick' }, badgeText);

  row.append(left, badge);

  if (options.clickable && typeof options.onClick === 'function') {
    const handler = () => options.onClick(id);
    row.addEventListener('click', handler);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  }

  return row;
}

function buildMatch({ id, title, subtitle, teams, selectedId, onSelect, anchorTopId, anchorBottomId, championId }) {
  const card = el('div', { class: 'tourney-card', id });
  const header = el('div', { class: 'tourney-card-head' }, [
    el('div', { class: 'tourney-card-title' }, title),
    el('div', { class: 'tourney-card-sub' }, subtitle),
  ]);
  const body = el('div', { class: 'tourney-card-body' });

  teams.forEach((team) => {
    if (team.player) {
      body.appendChild(renderTeamRow(team.player, team.seed, {
        clickable: !!onSelect,
        onClick: onSelect,
        selected: selectedId === String(team.player.id),
        winner: selectedId === String(team.player.id),
        champion: championId === String(team.player.id),
      }));
    } else {
      body.appendChild(renderTeamRow(null, null, {
        disabled: true,
        placeholder: team.placeholder,
        label: team.label,
        showDot: true,
      }));
    }
  });

  if (anchorTopId) body.appendChild(el('div', { class: 'flow-anchor flow-top', id: anchorTopId }));
  if (anchorBottomId) body.appendChild(el('div', { class: 'flow-anchor flow-bottom', id: anchorBottomId }));

  card.append(header, body);
  return card;
}

function drawLine(svg, fromEl, toEl, opts = {}) {
  if (!svg || !fromEl || !toEl) return;
  const s = svg.getBoundingClientRect();
  const a = fromEl.getBoundingClientRect();
  const b = toEl.getBoundingClientRect();
  const x1 = a.left + a.width / 2 - s.left;
  const y1 = a.top + a.height / 2 - s.top;
  const x2 = b.left + b.width / 2 - s.left;
  const y2 = b.top + b.height / 2 - s.top;
  const midY = y1 + (y2 - y1) * 0.5;
  const d = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`;

  const glow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  glow.setAttribute('d', d);
  glow.setAttribute('fill', 'none');
  glow.setAttribute('stroke', opts.glow || 'rgba(99,102,241,0.20)');
  glow.setAttribute('stroke-width', '10');
  glow.setAttribute('stroke-linecap', 'round');
  svg.appendChild(glow);

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', d);
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke', opts.stroke || 'rgba(245,166,35,0.72)');
  path.setAttribute('stroke-width', '2.5');
  path.setAttribute('stroke-linecap', 'round');
  svg.appendChild(path);
}

function redrawLines() {
  const svg = document.getElementById('bracketLines');
  const wrap = document.querySelector('.playoff-board-wrap');
  if (!svg || !wrap) return;
  svg.innerHTML = '';
  const rect = wrap.getBoundingClientRect();
  svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`);
  svg.setAttribute('preserveAspectRatio', 'none');

  drawLine(svg, document.getElementById('semi1-out-top'), document.getElementById('finals-in-left'));
  drawLine(svg, document.getElementById('semi2-out-top'), document.getElementById('finals-in-right'));
  drawLine(svg, document.getElementById('semi1-out-bottom'), document.getElementById('playin-in-left'), { stroke: 'rgba(99,102,241,0.72)', glow: 'rgba(245,166,35,0.16)' });
  drawLine(svg, document.getElementById('semi2-out-bottom'), document.getElementById('playin-in-right'), { stroke: 'rgba(99,102,241,0.72)', glow: 'rgba(245,166,35,0.16)' });
  drawLine(svg, document.getElementById('playin-out-top'), document.getElementById('finals-in-bottom'));
}

function renderBracket({ semi1, semi2, seedById }) {
  const bracket = document.getElementById('bracket');
  if (!bracket) return;

  function getGroups(picks) {
    const playIn = [...semi1.filter((p) => String(p.id) !== picks.semi1Winner), ...semi2.filter((p) => String(p.id) !== picks.semi2Winner)];
    const finals = [
      [...semi1, ...semi2].find((p) => String(p.id) === picks.semi1Winner),
      [...semi1, ...semi2].find((p) => String(p.id) === picks.semi2Winner),
      playIn.find((p) => String(p.id) === picks.playInWinner),
    ].filter(Boolean);
    return { semi1, semi2, playIn, finals };
  }

  let picks = normalizePicks(getPicks(), getGroups({ semi1Winner: null, semi2Winner: null, playInWinner: null }));

  function update(next) {
    picks = normalizePicks(next, getGroups(next));
    savePicks(picks);
    paint();
  }

  function selectSemi1(id) {
    const next = { ...picks, semi1Winner: picks.semi1Winner === id ? null : id, playInWinner: null, champion: null };
    update(next);
  }

  function selectSemi2(id) {
    const next = { ...picks, semi2Winner: picks.semi2Winner === id ? null : id, playInWinner: null, champion: null };
    update(next);
  }

  function selectPlayIn(id) {
    if (!picks.semi1Winner || !picks.semi2Winner) return;
    const next = { ...picks, playInWinner: picks.playInWinner === id ? null : id, champion: null };
    update(next);
  }

  function selectChampion(id) {
    if (![picks.semi1Winner, picks.semi2Winner, picks.playInWinner].includes(id)) return;
    const next = { ...picks, champion: picks.champion === id ? null : id };
    update(next);
  }

  function resetAll() {
    update({ semi1Winner: null, semi2Winner: null, playInWinner: null, champion: null });
  }

  function paint() {
    bracket.innerHTML = '';
    const groups = getGroups(picks);
    picks = normalizePicks(picks, groups);

    const semi1Card = buildMatch({
      id: 'match-semi1',
      title: 'Semifinal 1',
      subtitle: 'Best of 4 · Seeds 1, 5, 6',
      teams: semi1.map((p) => ({ player: p, seed: seedById.get(String(p.id)) })),
      selectedId: picks.semi1Winner,
      onSelect: selectSemi1,
      anchorTopId: 'semi1-out-top',
      anchorBottomId: 'semi1-out-bottom',
    });

    const semi2Card = buildMatch({
      id: 'match-semi2',
      title: 'Semifinal 2',
      subtitle: 'Best of 4 · Seeds 2, 3, 4',
      teams: semi2.map((p) => ({ player: p, seed: seedById.get(String(p.id)) })),
      selectedId: picks.semi2Winner,
      onSelect: selectSemi2,
      anchorTopId: 'semi2-out-top',
      anchorBottomId: 'semi2-out-bottom',
    });

    const playInReady = !!(picks.semi1Winner && picks.semi2Winner);
    const playInTeams = playInReady
      ? groups.playIn.map((p) => ({ player: p, seed: seedById.get(String(p.id)) }))
      : [
          { placeholder: 'Semifinal 1 Loser', label: 'Play-In Spot' },
          { placeholder: 'Semifinal 1 Loser', label: 'Play-In Spot' },
          { placeholder: 'Semifinal 2 Loser', label: 'Play-In Spot' },
          { placeholder: 'Semifinal 2 Loser', label: 'Play-In Spot' },
        ];

    const playInCard = buildMatch({
      id: 'match-playin',
      title: 'Play-In',
      subtitle: 'One game · 4 players',
      teams: playInTeams,
      selectedId: picks.playInWinner,
      onSelect: playInReady ? selectPlayIn : null,
      anchorTopId: 'playin-out-top',
    });
    playInCard.appendChild(el('div', { class: 'flow-anchor edge-left', id: 'playin-in-left' }));
    playInCard.appendChild(el('div', { class: 'flow-anchor edge-right', id: 'playin-in-right' }));

    const finalsTeams = [
      groups.semi1.find((p) => String(p.id) === picks.semi1Winner),
      groups.semi2.find((p) => String(p.id) === picks.semi2Winner),
      groups.playIn.find((p) => String(p.id) === picks.playInWinner),
    ].map((p, idx) => p ? ({ player: p, seed: seedById.get(String(p.id)) }) : ({ placeholder: ['Semifinal 1 Winner', 'Semifinal 2 Winner', 'Play-In Winner'][idx], label: `Finalist ${idx + 1}` }));

    const finalsCard = buildMatch({
      id: 'match-finals',
      title: 'Championship',
      subtitle: '3-game series',
      teams: finalsTeams,
      selectedId: picks.champion,
      championId: picks.champion,
      onSelect: groups.finals.length === 3 ? selectChampion : null,
    });
    finalsCard.appendChild(el('div', { class: 'flow-anchor edge-left high', id: 'finals-in-left' }));
    finalsCard.appendChild(el('div', { class: 'flow-anchor edge-right high', id: 'finals-in-right' }));
    finalsCard.appendChild(el('div', { class: 'flow-anchor edge-bottom', id: 'finals-in-bottom' }));

    const controls = el('div', { class: 'bracket-controls tournament-controls' }, [
      el('div', { class: 'bracket-hint' }, 'Pick one semifinal winner per side. Once both are set, the Play-In auto-fills with the remaining four players.'),
      el('button', { class: 'btn small', type: 'button', onclick: resetAll }, 'Reset bracket'),
    ]);

    bracket.append(
      el('div', { class: 'board-slot slot-finals' }, [finalsCard]),
      el('div', { class: 'board-slot slot-semi1' }, [semi1Card]),
      el('div', { class: 'board-slot slot-semi2' }, [semi2Card]),
      el('div', { class: 'board-slot slot-playin' }, [playInCard]),
      controls,
    );

    requestAnimationFrame(redrawLines);
    setTimeout(redrawLines, 250);
  }

  paint();
  window.addEventListener('resize', redrawLines, { passive: true });
}

async function loadPlayoffs() {
  try {
    const res = await fetch(DATA_URL);
    const data = await res.json();
    setUpdated(data.updated ? `Updated ${data.updated}` : 'Live seeding');
    const standings = computeStandings(data);
    const { topSix, seedById } = seedsFromStandings(standings);
    const bySeed = new Map();
    topSix.forEach((p) => bySeed.set(seedById.get(String(p.id)), p));
    const semi1 = [bySeed.get(1), bySeed.get(5), bySeed.get(6)].filter(Boolean);
    const semi2 = [bySeed.get(2), bySeed.get(3), bySeed.get(4)].filter(Boolean);
    renderBracket({ semi1, semi2, seedById });
  } catch (err) {
    console.error(err);
    setUpdated('Could not load data');
    const bracket = document.getElementById('bracket');
    if (bracket) bracket.innerHTML = '<div class="card">Error loading bracket.</div>';
  }
}

loadPlayoffs();
