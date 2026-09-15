const API_BASE = "https://api.wiseoldman.net/v2";
const STORAGE_KEY = "osrs-tracker-username";

const SKILL_ORDER = [
  "overall", "attack", "defence", "strength", "hitpoints", "ranged",
  "prayer", "magic", "cooking", "woodcutting", "fletching", "fishing",
  "firemaking", "crafting", "smithing", "mining", "herblore", "agility",
  "thieving", "slayer", "farming", "runecrafting", "hunter", "construction"
];

const SKILL_ICONS = {
  overall: "\u{1F4CA}", attack: "⚔️", defence: "\u{1F6E1}️",
  strength: "\u{1F4AA}", hitpoints: "❤️", ranged: "\u{1F3F9}",
  prayer: "✨", magic: "\u{1F52E}", cooking: "\u{1F373}",
  woodcutting: "\u{1FA93}", fletching: "\u{1FAB6}", fishing: "\u{1F3A3}",
  firemaking: "\u{1F525}", crafting: "\u{1F9F5}", smithing: "\u{1F528}",
  mining: "⛏️", herblore: "\u{1F9EA}", agility: "\u{1F938}",
  thieving: "\u{1F575}️", slayer: "\u{1F480}", farming: "\u{1F33E}",
  runecrafting: "\u{1F537}", hunter: "\u{1F43E}", construction: "\u{1F3E0}"
};

const numberFmt = new Intl.NumberFormat("en-US");

const els = {
  form: document.getElementById("search-form"),
  input: document.getElementById("username-input"),
  searchBtn: document.getElementById("search-btn"),
  status: document.getElementById("status"),
  dashboard: document.getElementById("dashboard"),
  playerName: document.getElementById("player-name"),
  playerType: document.getElementById("player-type"),
  statCombat: document.getElementById("stat-combat"),
  statTotalLevel: document.getElementById("stat-total-level"),
  statTotalXp: document.getElementById("stat-total-xp"),
  statEhp: document.getElementById("stat-ehp"),
  statEhb: document.getElementById("stat-ehb"),
  statUpdated: document.getElementById("stat-updated"),
  refreshBtn: document.getElementById("refresh-btn"),
  skillsList: document.getElementById("skills-list"),
  bossesList: document.getElementById("bosses-list"),
  bossesEmpty: document.getElementById("bosses-empty"),
  tabs: document.querySelectorAll(".tab"),
  panels: {
    skills: document.getElementById("tab-skills"),
    bosses: document.getElementById("tab-bosses"),
    gains: document.getElementById("tab-gains"),
    quests: document.getElementById("tab-quests")
  },
  periodPicker: document.getElementById("period-picker"),
  gainsSummary: document.getElementById("gains-summary"),
  gainsSkills: document.getElementById("gains-skills"),
  gainsBosses: document.getElementById("gains-bosses")
};

let currentPlayer = null;
let currentPeriod = "week";

function setStatus(message, type) {
  if (!message) {
    els.status.hidden = true;
    els.status.innerHTML = "";
    return;
  }
  els.status.hidden = false;
  els.status.className = "status" + (type ? " " + type : "");
  els.status.innerHTML = message;
}

function setLoading(isLoading) {
  els.searchBtn.disabled = isLoading;
  els.searchBtn.textContent = isLoading ? "..." : "Track";
}

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    try {
      const body = await res.json();
      if (body && body.message) err.message = body.message;
    } catch (_) {}
    throw err;
  }
  return res.json();
}

async function apiPost(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST" });
  if (!res.ok) {
    const err = new Error(`Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function fetchPlayer(username) {
  return apiGet(`/players/${encodeURIComponent(username)}`);
}

function trackPlayer(username) {
  return apiPost(`/players/${encodeURIComponent(username)}`);
}

function fetchGains(username, period) {
  return apiGet(`/players/${encodeURIComponent(username)}/gained?period=${period}`);
}

function formatDate(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function renderPlayer(player) {
  currentPlayer = player;
  const snapshot = player.latestSnapshot;
  const data = snapshot ? snapshot.data : null;

  els.playerName.textContent = player.displayName || player.username;
  els.playerType.textContent = (player.type || "unknown").replace(/_/g, " ");
  els.statCombat.textContent = player.combatLevel != null ? player.combatLevel : "-";

  const overall = data && data.skills ? data.skills.overall : null;
  els.statTotalLevel.textContent = overall && overall.level != null ? numberFmt.format(overall.level) : "-";
  els.statTotalXp.textContent = overall && overall.experience != null ? numberFmt.format(overall.experience) : "-";
  els.statEhp.textContent = player.ehp != null ? Math.round(player.ehp) : "-";
  els.statEhb.textContent = player.ehb != null ? Math.round(player.ehb) : "-";
  els.statUpdated.textContent = formatDate(player.updatedAt);

  renderSkills(data && data.skills);
  renderBosses(data && data.bosses);

  els.dashboard.hidden = false;

  window.dispatchEvent(new CustomEvent("osrs-tracker:player-loaded", {
    detail: { skills: (data && data.skills) || {} }
  }));
}

function renderSkills(skills) {
  els.skillsList.innerHTML = "";
  if (!skills) return;

  SKILL_ORDER.forEach((key) => {
    const skill = skills[key];
    if (!skill) return;
    const card = document.createElement("div");
    card.className = "info-card";
    const level = skill.level != null ? skill.level : "-";
    const xp = skill.experience != null && skill.experience >= 0 ? numberFmt.format(skill.experience) : "0";
    const rank = skill.rank != null && skill.rank > 0 ? `Rank ${numberFmt.format(skill.rank)}` : "Unranked";
    card.innerHTML = `
      <span class="info-icon">${SKILL_ICONS[key] || "⭐"}</span>
      <div class="info-body">
        <div class="info-name">${key}</div>
        <div class="info-main">Lvl ${level}</div>
        <div class="info-sub">${xp} xp &middot; ${rank}</div>
      </div>
    `;
    els.skillsList.appendChild(card);
  });
}

function renderBosses(bosses) {
  els.bossesList.innerHTML = "";
  if (!bosses) {
    els.bossesEmpty.hidden = false;
    return;
  }

  const entries = Object.entries(bosses)
    .filter(([, boss]) => boss && boss.kills > 0)
    .sort((a, b) => b[1].kills - a[1].kills);

  els.bossesEmpty.hidden = entries.length > 0;

  entries.forEach(([key, boss]) => {
    const card = document.createElement("div");
    card.className = "info-card";
    const rank = boss.rank != null && boss.rank > 0 ? `Rank ${numberFmt.format(boss.rank)}` : "Unranked";
    card.innerHTML = `
      <span class="info-icon">\u{1F479}</span>
      <div class="info-body">
        <div class="info-name">${prettify(key)}</div>
        <div class="info-main">${numberFmt.format(boss.kills)} KC</div>
        <div class="info-sub">${rank}</div>
      </div>
    `;
    els.bossesList.appendChild(card);
  });
}

function prettify(key) {
  return key.replace(/_/g, " ");
}

async function renderGains(username, period) {
  els.gainsSummary.innerHTML = `<div class="stat"><span class="spinner"></span></div>`;
  els.gainsSkills.innerHTML = "";
  els.gainsBosses.innerHTML = "";

  let gains;
  try {
    gains = await fetchGains(username, period);
  } catch (err) {
    els.gainsSummary.innerHTML = "";
    els.gainsSkills.innerHTML = `<p class="empty-msg">Couldn't load gains right now.</p>`;
    return;
  }

  const data = gains.data || {};
  const overall = data.skills ? data.skills.overall : null;
  const xpGained = overall && overall.experience ? overall.experience.gained : 0;
  const rankChange = overall && overall.rank ? overall.rank.gained : 0;

  els.gainsSummary.innerHTML = `
    <div class="stat">
      <span class="stat-value">${numberFmt.format(xpGained || 0)}</span>
      <span class="stat-label">Total XP gained</span>
    </div>
    <div class="stat">
      <span class="stat-value">${rankChange > 0 ? "+" : ""}${numberFmt.format(rankChange || 0)}</span>
      <span class="stat-label">Overall rank change</span>
    </div>
  `;

  const skillGains = Object.entries(data.skills || {})
    .filter(([key]) => key !== "overall")
    .map(([key, s]) => [key, s.experience ? s.experience.gained : 0])
    .filter(([, gained]) => gained > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (skillGains.length === 0) {
    els.gainsSkills.innerHTML = `<p class="empty-msg">No skill XP gained this period.</p>`;
  } else {
    skillGains.forEach(([key, gained]) => {
      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <span class="info-icon">${SKILL_ICONS[key] || "⭐"}</span>
        <div class="info-body">
          <div class="info-name">${key}</div>
          <div class="info-main">+${numberFmt.format(gained)}</div>
          <div class="info-sub">xp gained</div>
        </div>
      `;
      els.gainsSkills.appendChild(card);
    });
  }

  const bossGains = Object.entries(data.bosses || {})
    .map(([key, b]) => [key, b.kills ? b.kills.gained : 0])
    .filter(([, gained]) => gained > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  if (bossGains.length === 0) {
    els.gainsBosses.innerHTML = `<p class="empty-msg">No boss kills gained this period.</p>`;
  } else {
    bossGains.forEach(([key, gained]) => {
      const card = document.createElement("div");
      card.className = "info-card";
      card.innerHTML = `
        <span class="info-icon">\u{1F479}</span>
        <div class="info-body">
          <div class="info-name">${prettify(key)}</div>
          <div class="info-main">+${numberFmt.format(gained)}</div>
          <div class="info-sub">kills gained</div>
        </div>
      `;
      els.gainsBosses.appendChild(card);
    });
  }
}

async function loadPlayer(username, { allowTrackPrompt = true } = {}) {
  setLoading(true);
  setStatus(`<span class="spinner"></span>Loading ${username}...`);
  els.dashboard.hidden = true;

  try {
    const player = await fetchPlayer(username);
    setStatus(null);
    renderPlayer(player);
    localStorage.setItem(STORAGE_KEY, username);
    renderGains(username, currentPeriod);
  } catch (err) {
    if (err.status === 404 && allowTrackPrompt) {
      setStatus(
        `We don't have <strong>${escapeHtml(username)}</strong> yet.` +
        `<br><button class="status-action" id="track-btn">Add &amp; track this player</button>`,
        "error"
      );
      const trackBtn = document.getElementById("track-btn");
      if (trackBtn) {
        trackBtn.addEventListener("click", async () => {
          trackBtn.disabled = true;
          trackBtn.textContent = "Adding...";
          try {
            await trackPlayer(username);
            await loadPlayer(username, { allowTrackPrompt: false });
          } catch (e) {
            setStatus("Couldn't add that player. Check the spelling and try again.", "error");
          }
        });
      }
    } else {
      setStatus(`Something went wrong: ${escapeHtml(err.message || "unknown error")}`, "error");
    }
  } finally {
    setLoading(false);
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

els.form.addEventListener("submit", (e) => {
  e.preventDefault();
  const username = els.input.value.trim();
  if (!username) return;
  loadPlayer(username);
});

els.refreshBtn.addEventListener("click", async () => {
  if (!currentPlayer) return;
  const username = currentPlayer.username;
  els.refreshBtn.textContent = "Refreshing...";
  els.refreshBtn.disabled = true;
  try {
    await trackPlayer(username);
    await loadPlayer(username, { allowTrackPrompt: false });
  } catch (e) {
    setStatus("Couldn't refresh right now. Try again shortly.", "error");
  } finally {
    els.refreshBtn.textContent = "Refresh from RuneScape hiscores";
    els.refreshBtn.disabled = false;
  }
});

els.tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    els.tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const target = tab.dataset.tab;
    Object.entries(els.panels).forEach(([name, panel]) => {
      panel.hidden = name !== target;
    });
  });
});

els.periodPicker.addEventListener("click", (e) => {
  const btn = e.target.closest(".period");
  if (!btn || !currentPlayer) return;
  els.periodPicker.querySelectorAll(".period").forEach((p) => p.classList.remove("active"));
  btn.classList.add("active");
  currentPeriod = btn.dataset.period;
  renderGains(currentPlayer.username, currentPeriod);
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

const savedUsername = localStorage.getItem(STORAGE_KEY);
if (savedUsername) {
  els.input.value = savedUsername;
  loadPlayer(savedUsername);
}
