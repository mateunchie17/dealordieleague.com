{\rtf1\ansi\ansicpg1252\cocoartf2822
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fswiss\fcharset0 Helvetica;}
{\colortbl;\red255\green255\blue255;}
{\*\expandedcolortbl;;}
\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\pard\tx720\tx1440\tx2160\tx2880\tx3600\tx4320\tx5040\tx5760\tx6480\tx7200\tx7920\tx8640\pardirnatural\partightenfactor0

\f0\fs24 \cf0 const DATA_URL = "PASTE_YOUR_WEB_APP_URL_HERE";\
\
function pct(wins, games) \{\
  if (!games) return "0.0%";\
  return ((wins / games) * 100).toFixed(1) + "%";\
\}\
\
function formatDate(d) \{\
  const dt = new Date(d);\
  if (isNaN(dt.getTime())) return String(d || "");\
  return dt.toLocaleString();\
\}\
\
async function load() \{\
  const res = await fetch(DATA_URL);\
  const data = await res.json();\
\
  const playersById = \{\};\
  data.players.forEach(p => \{ playersById[p.player_id] = p; \});\
\
  const stats = \{\};\
  data.players.forEach(p => \{\
    if (String(p.active).toLowerCase() === "false") return;\
\
    stats[p.player_id] = \{\
      name: p.name,\
      wins: Number(p.starting_wins || 0),\
      games: Number(p.starting_games || 0),\
    \};\
  \});\
\
  data.games.forEach(g => \{\
    const winner = g.winner_id;\
    const participants = g.player_ids || [];\
\
    participants.forEach(pid => \{\
      if (!stats[pid]) return;\
      stats[pid].games += 1;\
    \});\
\
    if (stats[winner]) stats[winner].wins += 1;\
  \});\
\
  const rows = Object.entries(stats).map(([id, s]) => (\{\
    id,\
    name: s.name,\
    wins: s.wins,\
    games: s.games,\
    points: s.wins * 2,\
    winPct: pct(s.wins, s.games),\
  \}));\
\
  rows.sort((a, b) => b.points - a.points);\
\
  const lbBody = document.querySelector("#leaderboard tbody");\
  lbBody.innerHTML = "";\
  rows.forEach(r => \{\
    const tr = document.createElement("tr");\
    tr.innerHTML = `\
      <td>$\{r.name\}</td>\
      <td>$\{r.points\}</td>\
      <td>$\{r.wins\}</td>\
      <td>$\{r.games\}</td>\
      <td>$\{r.winPct\}</td>\
    `;\
    lbBody.appendChild(tr);\
  \});\
\
  document.getElementById("updated").textContent =\
    "Last updated: " + new Date().toLocaleString();\
\}\
\
load();\
setInterval(load, 30000);\
}