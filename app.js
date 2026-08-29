/**
 * Living Dex Tracker & Hunting Planner
 * National Dex #001 to #807 (Gen 1 through Gen 7)
 */

const MAX_POKEMON = 807;
const STORAGE_KEY = 'gen7_living_dex_data';
const SCRIPT_URL_KEY = 'gen7_sheets_script_url';
const NOW_PLAYING_KEY = 'gen7_now_playing';

// Comprehensive Game Hierarchy
const GAME_GROUPS = {
  "Storage & External": [
    { name: "Pokémon Bank", maxDex: 807 },
    { name: "Pokémon HOME", maxDex: 807 },
    { name: "Not Deposited", maxDex: 807 }
  ],
  "Generation VII (3DS)": [
    { name: "Ultra Sun", maxDex: 807 },
    { name: "Ultra Moon", maxDex: 807 },
    { name: "Sun", maxDex: 802 },
    { name: "Moon", maxDex: 802 }
  ],
  "Generation VI (3DS)": [
    { name: "Omega Ruby", maxDex: 721 },
    { name: "Alpha Sapphire", maxDex: 721 },
    { name: "X", maxDex: 721 },
    { name: "Y", maxDex: 721 }
  ],
  "Generation V (NDS)": [
    { name: "Black 2", maxDex: 649 },
    { name: "White 2", maxDex: 649 },
    { name: "Black", maxDex: 649 },
    { name: "White", maxDex: 649 }
  ],
  "Generation IV (NDS)": [
    { name: "HeartGold", maxDex: 493 },
    { name: "SoulSilver", maxDex: 493 },
    { name: "Platinum", maxDex: 493 },
    { name: "Diamond", maxDex: 493 },
    { name: "Pearl", maxDex: 493 }
  ],
  "Generation III (GBA)": [
    { name: "Emerald", maxDex: 386 },
    { name: "FireRed", maxDex: 386 },
    { name: "LeafGreen", maxDex: 386 },
    { name: "Ruby", maxDex: 386 },
    { name: "Sapphire", maxDex: 386 }
  ],
  "Generation II (GBC)": [
    { name: "Crystal", maxDex: 251 },
    { name: "Gold", maxDex: 251 },
    { name: "Silver", maxDex: 251 }
  ],
  "Generation I (GB)": [
    { name: "Yellow", maxDex: 151 },
    { name: "Red", maxDex: 151 },
    { name: "Blue", maxDex: 151 }
  ]
};

let pokemonList = [];
let userState = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
let syncTimeout = null;

// DOM Elements
const grid = document.getElementById('pokemonGrid');
const searchInput = document.getElementById('search');
const gameFilter = document.getElementById('gameFilter');
const nowPlayingSelect = document.getElementById('nowPlaying');
const caughtVisibility = document.getElementById('caughtVisibility');
const progressCount = document.getElementById('progress-count');
const progressPercent = document.getElementById('progress-percent');
const progressFill = document.getElementById('progress-fill');

// Planner DOM Elements
const tabDexBtn = document.getElementById('tabDexBtn');
const tabPlannerBtn = document.getElementById('tabPlannerBtn');
const dexView = document.getElementById('dexView');
const plannerView = document.getElementById('plannerView');
const plannerContainer = document.getElementById('plannerContainer');
const plannerGameFilter = document.getElementById('plannerGameFilter');
const plannerStatusFilter = document.getElementById('plannerStatusFilter');
const plannedCountBadge = document.getElementById('plannedCountBadge');

// Cloud Sync DOM Elements
const syncDot = document.getElementById('syncDot');
const syncText = document.getElementById('syncText');
const quickSyncBtn = document.getElementById('quickSyncBtn');
const cloudModal = document.getElementById('cloudModal');
const openModalBtn = document.getElementById('openModalBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalUrlInput = document.getElementById('modalUrlInput');
const saveAndSyncBtn = document.getElementById('saveAndSyncBtn');
const disconnectBtn = document.getElementById('disconnectBtn');

// Helper Functions
function getDexLimit(gameName) {
  if (gameName === 'ALL') return 807;
  for (const group of Object.values(GAME_GROUPS)) {
    const found = group.find(g => g.name === gameName);
    if (found) return found.maxDex;
  }
  return 807;
}

function getGen(id) {
  if (id <= 151) return 'Gen 1';
  if (id <= 251) return 'Gen 2';
  if (id <= 386) return 'Gen 3';
  if (id <= 493) return 'Gen 4';
  if (id <= 649) return 'Gen 5';
  if (id <= 721) return 'Gen 6';
  return 'Gen 7';
}

function formatBulbapediaName(name) {
  return encodeURIComponent(name.charAt(0).toUpperCase() + name.slice(1));
}

function initUserState(id, name) {
  if (!userState[id]) {
    userState[id] = { name: name, caught: false, location: 'Pokémon Bank', plannedGame: '', planNotes: '' };
  }
  userState[id].name = name;
}

// Build Dynamic Options for Filters and Selects
function buildSelectOptions() {
  gameFilter.innerHTML = '<option value="ALL">All Gen 1–7 (#001 - #807)</option>';
  plannerGameFilter.innerHTML = '<option value="ALL">All Planned Games</option>';
  nowPlayingSelect.innerHTML = '';

  for (const [gen, games] of Object.entries(GAME_GROUPS)) {
    if (gen !== "Storage & External") {
      const optgroupFilter = document.createElement('optgroup');
      optgroupFilter.label = gen;
      const optgroupPlanner = document.createElement('optgroup');
      optgroupPlanner.label = gen;

      games.forEach(g => {
        const opt = document.createElement('option');
        opt.value = g.name;
        opt.textContent = `${g.name} (#001 - #${String(g.maxDex).padStart(3, '0')})`;
        optgroupFilter.appendChild(opt);

        const optP = document.createElement('option');
        optP.value = g.name;
        optP.textContent = g.name;
        optgroupPlanner.appendChild(optP);
      });

      gameFilter.appendChild(optgroupFilter);
      plannerGameFilter.appendChild(optgroupPlanner);
    }

    const optgroupPlaying = document.createElement('optgroup');
    optgroupPlaying.label = gen;
    games.forEach(g => {
      const opt = document.createElement('option');
      opt.value = g.name;
      opt.textContent = g.name;
      optgroupPlaying.appendChild(opt);
    });
    nowPlayingSelect.appendChild(optgroupPlaying);
  }

  nowPlayingSelect.value = localStorage.getItem(NOW_PLAYING_KEY) || "Ultra Sun";
}

function createGameSelectOptionsHTML(selectedGame) {
  let html = '<option value="">-- Select Target Game --</option>';
  for (const [gen, games] of Object.entries(GAME_GROUPS)) {
    if (gen === "Storage & External") continue;
    html += `<optgroup label="${gen}">`;
    games.forEach(g => {
      html += `<option value="${g.name}" ${selectedGame === g.name ? 'selected' : ''}>${g.name}</option>`;
    });
    html += `</optgroup>`;
  }
  return html;
}

function createLocationDropdownHTML(currentLoc) {
  let html = '';
  for (const [gen, games] of Object.entries(GAME_GROUPS)) {
    html += `<optgroup label="${gen}">`;
    games.forEach(g => {
      html += `<option value="${g.name}" ${currentLoc === g.name ? 'selected' : ''}>${g.name}</option>`;
    });
    html += `</optgroup>`;
  }
  return html;
}

// Fetch Pokémon Data
async function initPokemonData() {
  const cached = localStorage.getItem('gen7_pokemon_cache');
  if (cached) {
    pokemonList = JSON.parse(cached);
    renderCards();
    renderPlanner();
  }

  try {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon?limit=${MAX_POKEMON}`);
    const data = await res.json();
    pokemonList = data.results.map((p, index) => ({
      id: index + 1,
      name: p.name.replace('-', ' ')
    }));
    localStorage.setItem('gen7_pokemon_cache', JSON.stringify(pokemonList));
    renderCards();
    renderPlanner();
  } catch (e) {
    console.warn('PokéAPI offline, relying on cached data', e);
  }
}

// Render Dex Tracker View
function renderCards() {
  grid.innerHTML = '';
  const selectedGame = gameFilter.value;
  const maxDex = getDexLimit(selectedGame);
  const query = searchInput.value.toLowerCase().trim();
  const displayMode = caughtVisibility.value;

  const filtered = pokemonList.filter(p => {
    const matchesGame = p.id <= maxDex;
    const matchesQuery = p.name.toLowerCase().includes(query) || String(p.id).includes(query);
    return matchesGame && matchesQuery;
  });

  filtered.forEach(p => {
    const state = userState[p.id] || { caught: false, location: 'Pokémon Bank', plannedGame: '', planNotes: '' };
    const card = document.createElement('div');
    card.className = `card ${state.caught ? 'caught' : ''} mode-${displayMode}`;
    card.id = `mon-${p.id}`;

    const bulbaUrl = `https://bulbapedia.bulbagarden.net/wiki/${formatBulbapediaName(p.name)}_(Pok%C3%A9mon)#Game_locations`;
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
    const hasPlan = Boolean(state.plannedGame || state.planNotes);

    card.innerHTML = `
      <div class="card-top">
        <span class="dex-num">#${String(p.id).padStart(3, '0')}</span>
        <div class="badge-wrap">
          ${hasPlan ? `<span class="plan-badge">🎯 ${state.plannedGame || 'Planned'}</span>` : ''}
          <span class="gen-badge">${getGen(p.id)}</span>
        </div>
      </div>
      <div class="card-main">
        <img class="sprite" src="${spriteUrl}" alt="${p.name}" loading="lazy">
        <div class="info">
          <span class="name">${p.name}</span>
          <a href="${bulbaUrl}" target="_blank" rel="noopener noreferrer" class="bulbapedia-link">
            Encounter Locations ↗
          </a>
        </div>
      </div>

      <button class="plan-toggle-btn" data-toggle-plan="${p.id}">
        ${hasPlan ? '📝 Edit Hunting Plan' : '🎯 + Plan Hunt in Game'}
      </button>
      
      <div class="plan-drawer" id="drawer-${p.id}">
        <select class="plan-game-select" data-plan-game="${p.id}">
          ${createGameSelectOptionsHTML(state.plannedGame)}
        </select>
        <input type="text" placeholder="Location/Method (e.g. Route 225 PokéRadar)" value="${state.planNotes || ''}" data-plan-notes="${p.id}">
      </div>

      <div class="card-bottom">
        <label class="checkbox-wrap">
          <input type="checkbox" ${state.caught ? 'checked' : ''} data-id="${p.id}">
          <span>Caught</span>
        </label>
        <select class="loc-select" data-loc="${p.id}">
          ${createLocationDropdownHTML(state.location)}
        </select>
      </div>
    `;

    // Toggle Card Plan Drawer
    const toggleBtn = card.querySelector(`[data-toggle-plan="${p.id}"]`);
    const drawer = card.querySelector(`#drawer-${p.id}`);
    toggleBtn.addEventListener('click', () => {
      drawer.classList.toggle('open');
    });

    // Plan Game Select
    const planGameSelect = card.querySelector(`[data-plan-game="${p.id}"]`);
    planGameSelect.addEventListener('change', (e) => {
      initUserState(p.id, p.name);
      userState[p.id].plannedGame = e.target.value;
      saveState();
      renderCards();
      renderPlanner();
    });

    // Plan Notes Input
    const planNotesInput = card.querySelector(`[data-plan-notes="${p.id}"]`);
    planNotesInput.addEventListener('input', (e) => {
      initUserState(p.id, p.name);
      userState[p.id].planNotes = e.target.value;
      saveState();
      updatePlanBadgeCount();
    });

    // Checkbox toggle
    const checkbox = card.querySelector(`input[data-id="${p.id}"]`);
    const locSelect = card.querySelector(`select[data-loc="${p.id}"]`);
    checkbox.addEventListener('change', (e) => {
      const isCaught = e.target.checked;
      initUserState(p.id, p.name);
      userState[p.id].caught = isCaught;

      if (isCaught) {
        const targetGame = userState[p.id].plannedGame || nowPlayingSelect.value;
        userState[p.id].location = targetGame;
        locSelect.value = targetGame;
      }

      card.classList.toggle('caught', isCaught);
      saveState();
      renderPlanner();
    });

    // Location dropdown
    locSelect.addEventListener('change', (e) => {
      initUserState(p.id, p.name);
      userState[p.id].location = e.target.value;
      saveState();
    });

    grid.appendChild(card);
  });

  updateStats();
}

// Render Hunting To-Do Planner View (With Easy Inline Editing)
function renderPlanner() {
  const selectedGame = plannerGameFilter.value;
  const statusFilter = plannerStatusFilter.value;

  const plannedMons = pokemonList.filter(p => {
    const state = userState[p.id];
    if (!state) return false;
    const hasPlan = Boolean(state.plannedGame || state.planNotes);
    if (!hasPlan) return false;

    const matchesGame = selectedGame === 'ALL' || state.plannedGame === selectedGame;
    const matchesStatus = statusFilter === 'all' || !state.caught;
    return matchesGame && matchesStatus;
  });

  if (plannedMons.length === 0) {
    plannerContainer.innerHTML = `
      <div class="todo-empty">
        <h3>No planned hunts found ${selectedGame !== 'ALL' ? `for ${selectedGame}` : ''}</h3>
        <p style="margin-top: 8px;">Go to the <strong>Dex Tracker</strong> tab and click <em>"🎯 + Plan Hunt in Game"</em> on any Pokémon to add it here.</p>
      </div>
    `;
    return;
  }

  let html = '<div class="todo-list">';
  plannedMons.forEach(p => {
    const state = userState[p.id];
    const spriteUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
    const bulbaUrl = `https://bulbapedia.bulbagarden.net/wiki/${formatBulbapediaName(p.name)}_(Pok%C3%A9mon)#Game_locations`;

    html += `
      <div class="todo-item ${state.caught ? 'done' : ''}" id="todo-row-${p.id}">
        <div class="todo-main-row">
          <div class="todo-left">
            <img class="todo-sprite" src="${spriteUrl}" alt="${p.name}">
            <div class="todo-details">
              <div class="todo-title">
                #${String(p.id).padStart(3, '0')} ${p.name}
                <span class="todo-game-tag" id="tag-game-${p.id}">${state.plannedGame || 'Unassigned'}</span>
              </div>
              <div class="todo-note" id="text-note-${p.id}">${state.planNotes ? `📍 ${state.planNotes}` : '<em>No location notes</em>'}</div>
              <a href="${bulbaUrl}" target="_blank" rel="noopener noreferrer" class="bulbapedia-link">Bulbapedia Guide ↗</a>
            </div>
          </div>
          <div class="todo-actions">
            <button class="secondary small" data-todo-edit="${p.id}">✏️ Edit Plan</button>
            <button class="danger small" data-todo-delete="${p.id}" title="Remove from To-Do">🗑️</button>
            <button class="${state.caught ? 'secondary small' : 'small'}" data-todo-catch="${p.id}">
              ${state.caught ? '✅ Caught' : '🎯 Mark Caught'}
            </button>
          </div>
        </div>

        <div class="todo-edit-drawer" id="todo-edit-drawer-${p.id}">
          <select data-edit-game="${p.id}">
            ${createGameSelectOptionsHTML(state.plannedGame)}
          </select>
          <input type="text" placeholder="Hunting location/method..." value="${state.planNotes || ''}" data-edit-notes="${p.id}">
          <button class="small" data-save-inline="${p.id}">Done</button>
        </div>
      </div>
    `;
  });
  html += '</div>';

  plannerContainer.innerHTML = html;

  // Attach event handlers to dynamic To-Do buttons
  plannedMons.forEach(p => {
    const catchBtn = plannerContainer.querySelector(`[data-todo-catch="${p.id}"]`);
    const editBtn = plannerContainer.querySelector(`[data-todo-edit="${p.id}"]`);
    const deleteBtn = plannerContainer.querySelector(`[data-todo-delete="${p.id}"]`);
    const saveInlineBtn = plannerContainer.querySelector(`[data-save-inline="${p.id}"]`);
    const editDrawer = plannerContainer.querySelector(`#todo-edit-drawer-${p.id}`);

    // Mark Caught
    catchBtn.addEventListener('click', () => {
      initUserState(p.id, p.name);
      const isCurrentlyCaught = Boolean(userState[p.id].caught);
      userState[p.id].caught = !isCurrentlyCaught;

      if (!isCurrentlyCaught) {
        userState[p.id].location = userState[p.id].plannedGame || nowPlayingSelect.value;
      }

      saveState();
      renderCards();
      renderPlanner();
    });

    // Toggle Inline Edit
    editBtn.addEventListener('click', () => {
      editDrawer.classList.toggle('open');
    });

    // Close Inline Edit Drawer
    saveInlineBtn.addEventListener('click', () => {
      editDrawer.classList.remove('open');
    });

    // Inline Game Selection Change
    const gameSelect = plannerContainer.querySelector(`[data-edit-game="${p.id}"]`);
    gameSelect.addEventListener('change', (e) => {
      initUserState(p.id, p.name);
      userState[p.id].plannedGame = e.target.value;
      saveState();
      renderCards();
      renderPlanner();
    });

    // Inline Notes Change
    const notesInput = plannerContainer.querySelector(`[data-edit-notes="${p.id}"]`);
    notesInput.addEventListener('input', (e) => {
      initUserState(p.id, p.name);
      userState[p.id].planNotes = e.target.value;
      saveState();
      
      const noteDisplay = plannerContainer.querySelector(`#text-note-${p.id}`);
      if (noteDisplay) {
        noteDisplay.innerHTML = e.target.value ? `📍 ${e.target.value}` : '<em>No location notes</em>';
      }
      updatePlanBadgeCount();
    });

    // Delete / Unplan Hunt
    deleteBtn.addEventListener('click', () => {
      if (confirm(`Remove ${p.name} from your hunting plans?`)) {
        initUserState(p.id, p.name);
        userState[p.id].plannedGame = '';
        userState[p.id].planNotes = '';
        saveState();
        renderCards();
        renderPlanner();
      }
    });
  });
}

function updatePlanBadgeCount() {
  let count = 0;
  for (const id in userState) {
    if (!userState[id].caught && (userState[id].plannedGame || userState[id].planNotes)) {
      count++;
    }
  }
  plannedCountBadge.textContent = count;
}

function updateStats() {
  const selectedGame = gameFilter.value;
  const maxDex = getDexLimit(selectedGame);
  const total = maxDex;
  
  let caughtCount = 0;
  for (let i = 1; i <= maxDex; i++) {
    if (userState[i]?.caught) caughtCount++;
  }

  const percent = total > 0 ? Math.round((caughtCount / total) * 100) : 0;
  progressCount.textContent = `Progress: ${caughtCount} / ${total} caught`;
  progressPercent.textContent = `${percent}%`;
  progressFill.style.width = `${percent}%`;
  updatePlanBadgeCount();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
  updateStats();
  
  const scriptUrl = localStorage.getItem(SCRIPT_URL_KEY);
  if (scriptUrl) {
    setSyncStatus('syncing', 'Saving to Google Sheet...');
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => syncToGoogleSheets(scriptUrl), 1500);
  }
}

function setSyncStatus(state, msg) {
  syncDot.className = `status-dot ${state}`;
  syncText.textContent = msg;
}

// Google Sheets Sync
async function syncToGoogleSheets(url) {
  try {
    setSyncStatus('syncing', 'Syncing...');
    await fetch(url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userState)
    });
    setSyncStatus('synced', 'Synced with Sheet');
  } catch (err) {
    setSyncStatus('error', 'Sync Failed');
    console.error(err);
  }
}

async function pullFromGoogleSheets(url) {
  try {
    setSyncStatus('syncing', 'Fetching sheet data...');
    const res = await fetch(url);
    const cloudData = await res.json();
    
    if (cloudData && typeof cloudData === 'object') {
      userState = { ...userState, ...cloudData };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(userState));
      renderCards();
      renderPlanner();
      setSyncStatus('synced', 'Synced with Sheet');
    }
  } catch (err) {
    setSyncStatus('error', 'Connection Error');
    console.error(err);
  }
}

// Tab Switching
tabDexBtn.addEventListener('click', () => {
  tabDexBtn.classList.add('active');
  tabPlannerBtn.classList.remove('active');
  dexView.classList.add('active');
  plannerView.classList.remove('active');
});

tabPlannerBtn.addEventListener('click', () => {
  tabPlannerBtn.classList.add('active');
  tabDexBtn.classList.remove('active');
  plannerView.classList.add('active');
  dexView.classList.remove('active');
  renderPlanner();
});

// Modal Handling
function updateSyncUI() {
  const savedUrl = localStorage.getItem(SCRIPT_URL_KEY);
  if (savedUrl) {
    modalUrlInput.value = savedUrl;
    disconnectBtn.style.display = 'inline-flex';
    quickSyncBtn.style.display = 'inline-flex';
    setSyncStatus('synced', 'Connected to Sheet');
  } else {
    modalUrlInput.value = '';
    disconnectBtn.style.display = 'none';
    quickSyncBtn.style.display = 'none';
    setSyncStatus('', 'Device Storage (Offline)');
  }
}

openModalBtn.addEventListener('click', () => {
  updateSyncUI();
  cloudModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
  cloudModal.classList.remove('active');
});

cloudModal.addEventListener('click', (e) => {
  if (e.target === cloudModal) cloudModal.classList.remove('active');
});

saveAndSyncBtn.addEventListener('click', () => {
  const url = modalUrlInput.value.trim();
  if (url) {
    localStorage.setItem(SCRIPT_URL_KEY, url);
    updateSyncUI();
    cloudModal.classList.remove('active');
    pullFromGoogleSheets(url);
  } else {
    alert('Please enter a valid Google Apps Script URL.');
  }
});

disconnectBtn.addEventListener('click', () => {
  if (confirm('Disconnect Google Sheet?')) {
    localStorage.removeItem(SCRIPT_URL_KEY);
    updateSyncUI();
    cloudModal.classList.remove('active');
  }
});

quickSyncBtn.addEventListener('click', () => {
  const url = localStorage.getItem(SCRIPT_URL_KEY);
  if (url) pullFromGoogleSheets(url);
});

// Event Listeners for Filters
nowPlayingSelect.addEventListener('change', (e) => {
  localStorage.setItem(NOW_PLAYING_KEY, e.target.value);
});

searchInput.addEventListener('input', renderCards);
gameFilter.addEventListener('change', renderCards);
caughtVisibility.addEventListener('change', renderCards);
plannerGameFilter.addEventListener('change', renderPlanner);
plannerStatusFilter.addEventListener('change', renderPlanner);

// Initial Load
buildSelectOptions();
updateSyncUI();
const activeUrl = localStorage.getItem(SCRIPT_URL_KEY);
if (activeUrl) pullFromGoogleSheets(activeUrl);
initPokemonData();