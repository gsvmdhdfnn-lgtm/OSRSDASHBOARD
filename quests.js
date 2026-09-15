const QUEST_API = "https://oldschool.runescape.wiki/api.php";
const QUEST_CACHE_KEY = "osrs-tracker-quest-data-v1";
const QUEST_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const COMPLETED_QUESTS_KEY = "osrs-tracker-completed-quests";
const QUEST_POINTS_KEY = "osrs-tracker-quest-points";

// The wiki calls this skill "Runecraft"; Wise Old Man's API key for it is "runecrafting".
const WIKI_SKILL_TO_KEY = {
  runecraft: "runecrafting"
};

function normalizeSkillKey(wikiSkillName) {
  const lower = wikiSkillName.trim().toLowerCase();
  return WIKI_SKILL_TO_KEY[lower] || lower;
}

function unwrapBucketValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function decodeHtmlEntities(value) {
  const named = { amp: "&", apos: "'", gt: ">", lt: "<", nbsp: " ", quot: '"' };
  return value.replace(/&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/gi, (match, dec, hex, name) => {
    if (dec !== undefined) return String.fromCodePoint(parseInt(dec, 10));
    if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
    return named[String(name).toLowerCase()] || match;
  });
}

function cleanWikitext(source) {
  let value = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\[\[([^[\]]*)\]\]/g, (_match, inner) => {
      const parts = inner.split("|");
      const target = (parts[0] || "").trim();
      if (/^(file|image|category):/i.test(target)) return "";
      const display = parts.length > 1 ? parts[parts.length - 1].trim() : target.split("#")[0].trim();
      return display.replace(/^:/, "");
    })
    .replace(/'{2,5}/g, "");
  return decodeHtmlEntities(value).trim();
}

function splitWikiLine(rawLine) {
  const match = /^\s*([*#:;]+)\s*(.*?)\s*$/.exec(rawLine);
  return { depth: match ? match[1].length : 0, body: match ? match[2] : rawLine.trim() };
}

function readAttribute(text, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(text);
  return match ? match[2] : undefined;
}

function isNoneLine(cleaned) {
  const lower = cleaned.toLowerCase();
  return lower === "none" || lower === "none.";
}

/**
 * Parses a quest's "requirements" wikitext. Skill requirements are embedded as
 * <span data-skill="X" data-level="N"> markup rather than plain prose, which is
 * what makes them reliably extractable.
 */
function parseQuestRequirements(pageName, requirementsRaw, itemsRequiredRaw) {
  const skills = [];
  let questPoints;
  const prerequisiteQuests = [];
  const manualConditions = [];
  let prereqDepth;

  const lines = (requirementsRaw || "").split(/\r?\n/);
  for (const rawLine of lines) {
    const { depth, body } = splitWikiLine(rawLine);
    if (!body) continue;

    const skill = readAttribute(body, "data-skill");
    const levelText = readAttribute(body, "data-level");
    const level = levelText === undefined ? NaN : Number(levelText.replace(/,/g, ""));
    if (skill !== undefined && Number.isInteger(level) && level > 0) {
      skills.push({ skill: cleanWikitext(skill), level });
      continue;
    }

    const cleaned = cleanWikitext(body);
    if (!cleaned) continue;

    const qpMatch = /\b(\d[\d,]*)\s+Quest points?\b/i.exec(cleaned);
    if (qpMatch) {
      const parsed = Number(qpMatch[1].replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        questPoints = Math.max(questPoints || 0, parsed);
        continue;
      }
    }

    if (/^Completion of the following quests:?$/i.test(cleaned)) {
      prereqDepth = depth;
      continue;
    }

    if (prereqDepth !== undefined && depth > prereqDepth) {
      const linkMatch = /^\[\[\s*([^[\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]+)?\]\]$/.exec(body.trim());
      if (linkMatch) {
        prerequisiteQuests.push(cleanWikitext(linkMatch[1]).trim());
      } else if (!isNoneLine(cleaned)) {
        manualConditions.push(cleaned);
      }
      continue;
    }
    prereqDepth = undefined;

    if (!isNoneLine(cleaned)) {
      manualConditions.push(cleaned);
    }
  }

  const items = (itemsRequiredRaw || "")
    .split(/\r?\n/)
    .map((line) => cleanWikitext(line.replace(/^\s*[*#:;]+\s*/, "")))
    .filter((line) => line && !isNoneLine(line));

  return { quest: pageName, skills, questPoints, prerequisiteQuests, items, manualConditions };
}

async function fetchAllQuests() {
  try {
    const cached = JSON.parse(localStorage.getItem(QUEST_CACHE_KEY) || "null");
    if (cached && Date.now() - cached.fetchedAt < QUEST_CACHE_TTL_MS && Array.isArray(cached.quests)) {
      return cached.quests;
    }
  } catch (_) {}

  const query = "bucket('quest').select('page_name','requirements','items_required').limit(500).run()";
  const url = `${QUEST_API}?action=bucket&format=json&query=${encodeURIComponent(query)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Wiki request failed (${res.status})`);
  }
  const data = await res.json();
  const rows = data.bucket || [];

  const quests = rows
    .map((row) => {
      const pageName = unwrapBucketValue(row.page_name);
      if (!pageName || typeof pageName !== "string") return null;
      const requirements = unwrapBucketValue(row.requirements);
      const itemsRequired = unwrapBucketValue(row.items_required);
      return parseQuestRequirements(
        pageName,
        typeof requirements === "string" ? requirements : "",
        typeof itemsRequired === "string" ? itemsRequired : ""
      );
    })
    .filter(Boolean)
    .sort((a, b) => a.quest.localeCompare(b.quest));

  try {
    localStorage.setItem(QUEST_CACHE_KEY, JSON.stringify({ fetchedAt: Date.now(), quests }));
  } catch (_) {}

  return quests;
}

function getCompletedQuests() {
  try {
    return new Set(JSON.parse(localStorage.getItem(COMPLETED_QUESTS_KEY) || "[]"));
  } catch (_) {
    return new Set();
  }
}

function saveCompletedQuests(set) {
  localStorage.setItem(COMPLETED_QUESTS_KEY, JSON.stringify(Array.from(set)));
}

function getSavedQuestPoints() {
  const value = Number(localStorage.getItem(QUEST_POINTS_KEY));
  return Number.isFinite(value) ? value : 0;
}

function evaluateQuest(quest, playerSkills, questPoints, completedQuests) {
  const missingSkills = quest.skills
    .map((req) => {
      const key = normalizeSkillKey(req.skill);
      const have = playerSkills[key] != null ? playerSkills[key] : 0;
      return { ...req, have, met: have >= req.level };
    })
    .filter((req) => !req.met);

  const qpMet = quest.questPoints == null || questPoints >= quest.questPoints;
  const missingQuests = quest.prerequisiteQuests.filter((name) => !completedQuests.has(name));

  const eligible = missingSkills.length === 0 && qpMet && missingQuests.length === 0;

  return { eligible, missingSkills, qpMet, missingQuests };
}

function questWikiUrl(name) {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}

(function initQuestsTab() {
  const els = {
    tabButton: document.querySelector('.tab[data-tab="quests"]'),
    status: document.getElementById("quest-status"),
    list: document.getElementById("quest-list"),
    search: document.getElementById("quest-search"),
    qpInput: document.getElementById("quest-points-input"),
    filterEligible: document.getElementById("quest-filter-eligible"),
    filterHideDone: document.getElementById("quest-filter-hide-done")
  };

  if (!els.tabButton) return;

  let allQuests = null;
  let loading = false;
  let playerSkills = {};
  let hasPlayer = false;

  els.qpInput.value = getSavedQuestPoints() || "";

  window.addEventListener("osrs-tracker:player-loaded", (event) => {
    hasPlayer = true;
    const skills = event.detail.skills || {};
    playerSkills = {};
    Object.keys(skills).forEach((key) => {
      const skill = skills[key];
      if (skill && skill.level != null) playerSkills[key] = skill.level;
    });
    if (allQuests) renderList();
  });

  els.qpInput.addEventListener("input", () => {
    const value = Number(els.qpInput.value);
    localStorage.setItem(QUEST_POINTS_KEY, Number.isFinite(value) ? String(value) : "0");
    renderList();
  });

  els.search.addEventListener("input", renderList);
  els.filterEligible.addEventListener("change", renderList);
  els.filterHideDone.addEventListener("change", renderList);

  els.tabButton.addEventListener("click", () => {
    if (allQuests || loading) return;
    loadQuests();
  });

  async function loadQuests() {
    loading = true;
    setStatus(`<span class="spinner"></span>Loading quest list from the OSRS Wiki...`);
    try {
      allQuests = await fetchAllQuests();
      setStatus(null);
      renderList();
    } catch (err) {
      setStatus(
        `Couldn't load quest data from the wiki: ${escapeHtmlLocal(err.message || "unknown error")}`,
        "error"
      );
    } finally {
      loading = false;
    }
  }

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

  function renderList() {
    if (!allQuests) return;

    const query = els.search.value.trim().toLowerCase();
    const onlyEligible = els.filterEligible.checked;
    const hideDone = els.filterHideDone.checked;
    const questPoints = Number(els.qpInput.value) || 0;
    const completed = getCompletedQuests();

    els.list.innerHTML = "";

    let shown = 0;
    allQuests.forEach((quest) => {
      if (query && !quest.quest.toLowerCase().includes(query)) return;
      const isDone = completed.has(quest.quest);
      if (hideDone && isDone) return;

      const evaluation = evaluateQuest(quest, playerSkills, questPoints, completed);
      if (onlyEligible && !isDone && !evaluation.eligible) return;

      shown += 1;
      els.list.appendChild(renderQuestCard(quest, evaluation, isDone, completed));
    });

    if (shown === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-msg";
      empty.textContent = "No quests match your filters.";
      els.list.appendChild(empty);
    }
  }

  function renderQuestCard(quest, evaluation, isDone, completed) {
    const card = document.createElement("div");
    card.className = "quest-card" + (isDone ? " quest-done" : "");

    const badgeClass = isDone ? "quest-badge-done" : evaluation.eligible ? "quest-badge-ready" : "quest-badge-blocked";
    const badgeText = isDone ? "Completed" : evaluation.eligible ? "Ready" : "Not yet";

    const missingBits = [];
    evaluation.missingSkills.forEach((req) => {
      missingBits.push(`${capitalize(req.skill)} ${req.level} (have ${req.have})`);
    });
    if (!evaluation.qpMet) {
      missingBits.push(`${quest.questPoints} Quest Points (have ${Number(els.qpInput.value) || 0})`);
    }
    evaluation.missingQuests.forEach((name) => {
      missingBits.push(`Complete "${name}" first`);
    });

    const header = document.createElement("div");
    header.className = "quest-card-header";

    const nameLink = document.createElement("a");
    nameLink.href = questWikiUrl(quest.quest);
    nameLink.target = "_blank";
    nameLink.rel = "noopener";
    nameLink.className = "quest-name";
    nameLink.textContent = quest.quest;

    const badge = document.createElement("span");
    badge.className = "quest-badge " + badgeClass;
    badge.textContent = badgeText;

    header.appendChild(nameLink);
    header.appendChild(badge);
    card.appendChild(header);

    if (isDone) {
      // Self-reported as done - trust it and stop flagging unmet requirements.
    } else if (!hasPlayer) {
      const note = document.createElement("p");
      note.className = "quest-missing-note";
      note.textContent = "Track your account above to check skill requirements.";
      card.appendChild(note);
    } else if (missingBits.length > 0) {
      const missing = document.createElement("p");
      missing.className = "quest-missing-note";
      missing.textContent = "Missing: " + missingBits.join(", ");
      card.appendChild(missing);
    }

    if (quest.items.length > 0) {
      const items = document.createElement("p");
      items.className = "quest-extra-note";
      items.textContent = "Items needed: " + quest.items.join(", ");
      card.appendChild(items);
    }

    if (quest.manualConditions.length > 0) {
      const manual = document.createElement("p");
      manual.className = "quest-extra-note";
      manual.textContent = "Also: " + quest.manualConditions.join("; ");
      card.appendChild(manual);
    }

    const label = document.createElement("label");
    label.className = "quest-toggle quest-complete-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = isDone;
    checkbox.addEventListener("change", () => {
      const set = getCompletedQuests();
      if (checkbox.checked) set.add(quest.quest);
      else set.delete(quest.quest);
      saveCompletedQuests(set);
      renderList();
    });
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("I've completed this quest"));
    card.appendChild(label);

    return card;
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function escapeHtmlLocal(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
