(() => {
  "use strict";

  const CSV_PATH = "exercises.csv";
  const ASSETS_DIR = "assets";
  const PAGE_SIZE = 60;

  const BODYPART_ICONS = {
    waist: "🧘", "upper legs": "🦵", back: "🏋️", chest: "💪",
    "upper arms": "💪", shoulders: "🤸", "lower legs": "🦵",
    "lower arms": "🤜", cardio: "🏃", neck: "🧍",
  };

  /* ---------------- CSV parsing ---------------- */

  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; }
          else inQuotes = false;
        } else field += c;
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field); field = "";
      } else if (c === "\n") {
        row.push(field); field = "";
        rows.push(row); row = [];
      } else if (c === "\r") {
        // skip, \n handles line end
      } else {
        field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ""));
  }

  function rowsToExercises(rows) {
    const header = rows[0];
    const idx = {};
    header.forEach((h, i) => (idx[h] = i));

    const secondaryCols = header
      .map((h, i) => ({ h, i }))
      .filter(o => o.h.startsWith("secondaryMuscles/"))
      .sort((a, b) => +a.h.split("/")[1] - +b.h.split("/")[1]);
    const instructionCols = header
      .map((h, i) => ({ h, i }))
      .filter(o => o.h.startsWith("instructions/"))
      .sort((a, b) => +a.h.split("/")[1] - +b.h.split("/")[1]);

    const out = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every(v => v === "")) continue;
      const id = row[idx.id];
      if (!id) continue;
      out.push({
        id,
        name: row[idx.name] || "",
        bodyPart: row[idx.bodyPart] || "",
        equipment: row[idx.equipment] || "",
        target: row[idx.target] || "",
        secondaryMuscles: secondaryCols.map(c => row[c.i]).filter(Boolean),
        instructions: instructionCols.map(c => row[c.i]).filter(Boolean),
        gif: `${ASSETS_DIR}/${id}.gif`,
      });
    }
    return out;
  }

  /* ---------------- Persistence ---------------- */

  function loadFavorites() {
    try { return new Set(JSON.parse(localStorage.getItem("exlib-favorites")) || []); }
    catch { return new Set(); }
  }
  function saveFavorites() {
    localStorage.setItem("exlib-favorites", JSON.stringify([...state.favorites]));
  }
  // Older saved data stored workout entries as plain id strings; normalize
  // to {id, sets, reps} objects so old localStorage keeps working.
  function normalizeWorkoutEntry(x) {
    return typeof x === "string" ? { id: x, sets: 3, reps: 10 } : x;
  }
  function loadWorkoutDraft() {
    try { return (JSON.parse(localStorage.getItem("exlib-workout-current")) || []).map(normalizeWorkoutEntry); }
    catch { return []; }
  }
  function saveWorkoutDraft() {
    localStorage.setItem("exlib-workout-current", JSON.stringify(state.workout));
  }
  function loadSavedWorkouts() {
    try {
      const raw = JSON.parse(localStorage.getItem("exlib-workouts")) || {};
      const out = {};
      Object.keys(raw).forEach(name => { out[name] = (raw[name] || []).map(normalizeWorkoutEntry); });
      return out;
    } catch { return {}; }
  }
  function saveSavedWorkouts() {
    localStorage.setItem("exlib-workouts", JSON.stringify(state.savedWorkouts));
  }

  /* ---------------- State ---------------- */

  const state = {
    all: [],
    filtered: [],
    search: "",
    bodyPart: "all",
    equipment: "",
    target: "",
    sort: "name",
    visibleCount: PAGE_SIZE,
    favoritesOnly: false,
    favorites: loadFavorites(),
    workout: loadWorkoutDraft(),
    savedWorkouts: loadSavedWorkouts(),
  };

  function isFavorite(id) { return state.favorites.has(id); }
  function isInWorkout(id) { return state.workout.some(w => w.id === id); }
  function workoutEntry(id) { return state.workout.find(w => w.id === id); }
  function exerciseById(id) { return state.all.find(e => e.id === id); }

  let pendingSharedWorkout = null;

  /* ---------------- DOM refs ---------------- */

  const $ = sel => document.querySelector(sel);
  const grid = $("#grid");
  const resultCount = $("#resultCount");
  const activeChips = $("#activeChips");
  const emptyState = $("#emptyState");
  const categoryBar = $("#categoryBar");
  const searchInput = $("#searchInput");
  const clearSearchBtn = $("#clearSearch");
  const filterToggleBtn = $("#filterToggleBtn");
  const filterPanel = $("#filterPanel");
  const activeFilterCount = $("#activeFilterCount");
  const equipmentSelect = $("#equipmentSelect");
  const targetSelect = $("#targetSelect");
  const sortSelect = $("#sortSelect");
  const resetFiltersBtn = $("#resetFiltersBtn");
  const emptyResetBtn = $("#emptyResetBtn");
  const sentinel = $("#sentinel");
  const backToTop = $("#backToTop");
  const themeToggleBtn = $("#themeToggleBtn");
  const themeIconSun = $("#themeIconSun");
  const themeIconMoon = $("#themeIconMoon");

  const favToggleBtn = $("#favToggleBtn");
  const favIconOutline = $("#favIconOutline");
  const favIconFilled = $("#favIconFilled");
  const favCountBadge = $("#favCount");
  const workoutToggleBtn = $("#workoutToggleBtn");
  const workoutCountBadge = $("#workoutCount");

  const modalOverlay = $("#modalOverlay");
  const modalImg = $("#modalImg");
  const modalTitle = $("#modalTitle");
  const modalPosition = $("#modalPosition");
  const modalBadges = $("#modalBadges");
  const modalSecondary = $("#modalSecondary");
  const modalInstructions = $("#modalInstructions");
  const modalClose = $("#modalClose");
  const modalPrev = $("#modalPrev");
  const modalNext = $("#modalNext");
  const modalFavBtn = $("#modalFavBtn");
  const modalAddBtn = $("#modalAddBtn");

  const workoutDrawerOverlay = $("#workoutDrawerOverlay");
  const workoutDrawerClose = $("#workoutDrawerClose");
  const workoutShareBtn = $("#workoutShareBtn");
  const workoutEmptyState = $("#workoutEmptyState");
  const workoutList = $("#workoutList");
  const savedWorkoutsList = $("#savedWorkoutsList");
  const workoutNameInput = $("#workoutNameInput");
  const workoutSaveBtn = $("#workoutSaveBtn");
  const workoutClearBtn = $("#workoutClearBtn");
  const workoutStartBtn = $("#workoutStartBtn");

  const sharedWorkoutBanner = $("#sharedWorkoutBanner");
  const sharedBannerText = $("#sharedBannerText");
  const sharedBannerImport = $("#sharedBannerImport");
  const sharedBannerDismiss = $("#sharedBannerDismiss");

  const workoutModeOverlay = $("#workoutModeOverlay");
  const wmProgressFill = $("#wmProgressFill");
  const wmPosition = $("#wmPosition");
  const wmExitBtn = $("#wmExitBtn");
  const wmImg = $("#wmImg");
  const wmTitle = $("#wmTitle");
  const wmBadges = $("#wmBadges");
  const wmSetsReps = $("#wmSetsReps");
  const wmInstructions = $("#wmInstructions");
  const wmRestOverlay = $("#wmRestOverlay");
  const wmRestTime = $("#wmRestTime");
  const wmRestMinus = $("#wmRestMinus");
  const wmRestSkip = $("#wmRestSkip");
  const wmRestPlus = $("#wmRestPlus");
  const wmPrevBtn = $("#wmPrevBtn");
  const wmRestBtn = $("#wmRestBtn");
  const wmNextBtn = $("#wmNextBtn");

  const wmDoneOverlay = $("#wmDoneOverlay");
  const wmDoneSummary = $("#wmDoneSummary");
  const wmDoneCloseBtn = $("#wmDoneCloseBtn");

  let modalIndex = -1;

  /* ---------------- Init ---------------- */

  renderFavCount();
  renderWorkoutCount();

  fetch(CSV_PATH)
    .then(r => r.text())
    .then(text => {
      state.all = rowsToExercises(parseCSV(text));
      buildCategoryBar();
      buildFilterSelects();
      applyFilters();
      checkForSharedWorkout();
    })
    .catch(err => {
      resultCount.textContent = "Failed to load exercises.csv — " + err.message;
      console.error(err);
    });

  function buildCategoryBar() {
    const counts = new Map();
    state.all.forEach(e => counts.set(e.bodyPart, (counts.get(e.bodyPart) || 0) + 1));
    const parts = [...counts.keys()].sort();

    const allPill = makePill("all", "All", state.all.length);
    categoryBar.appendChild(allPill);
    parts.forEach(p => categoryBar.appendChild(makePill(p, p, counts.get(p))));

    updateActivePill();
  }

  function makePill(value, label, count) {
    const btn = document.createElement("button");
    btn.className = "category-pill";
    btn.dataset.value = value;
    const icon = BODYPART_ICONS[value] ? BODYPART_ICONS[value] + " " : "";
    btn.innerHTML = `${icon}${label} <span class="count">${count}</span>`;
    btn.addEventListener("click", () => {
      state.bodyPart = value;
      updateActivePill();
      applyFilters();
    });
    return btn;
  }

  function updateActivePill() {
    [...categoryBar.children].forEach(el =>
      el.classList.toggle("active", el.dataset.value === state.bodyPart)
    );
  }

  function buildFilterSelects() {
    const equipment = [...new Set(state.all.map(e => e.equipment))].filter(Boolean).sort();
    const targets = [...new Set(state.all.map(e => e.target))].filter(Boolean).sort();
    equipment.forEach(v => equipmentSelect.appendChild(new Option(v, v)));
    targets.forEach(v => targetSelect.appendChild(new Option(v, v)));
  }

  /* ---------------- Filtering ---------------- */

  function applyFilters() {
    const q = state.search.trim().toLowerCase();
    state.filtered = state.all.filter(e => {
      if (state.favoritesOnly && !state.favorites.has(e.id)) return false;
      if (state.bodyPart !== "all" && e.bodyPart !== state.bodyPart) return false;
      if (state.equipment && e.equipment !== state.equipment) return false;
      if (state.target && e.target !== state.target) return false;
      if (q) {
        const hay = `${e.name} ${e.target} ${e.bodyPart} ${e.equipment} ${e.secondaryMuscles.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    state.filtered.sort((a, b) => (a[state.sort] || "").localeCompare(b[state.sort] || "") || a.name.localeCompare(b.name));

    state.visibleCount = PAGE_SIZE;
    renderChips();
    renderCount();
    renderGrid(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderCount() {
    const n = state.filtered.length;
    resultCount.textContent = n === state.all.length
      ? `${n} exercises`
      : `${n} of ${state.all.length} exercises`;
  }

  function renderChips() {
    const chips = [];
    if (state.favoritesOnly) chips.push(["favoritesOnly", "★ Favorites"]);
    if (state.bodyPart !== "all") chips.push(["bodyPart", state.bodyPart]);
    if (state.equipment) chips.push(["equipment", state.equipment]);
    if (state.target) chips.push(["target", state.target]);
    if (state.search.trim()) chips.push(["search", `"${state.search.trim()}"`]);

    activeChips.innerHTML = "";
    chips.forEach(([key, label]) => {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.innerHTML = `${label} <button aria-label="Remove filter">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => clearFilter(key));
      activeChips.appendChild(chip);
    });

    const count = chips.length;
    activeFilterCount.textContent = count;
    activeFilterCount.classList.toggle("hidden", count === 0);
  }

  function clearFilter(key) {
    if (key === "favoritesOnly") setFavoritesOnly(false);
    if (key === "bodyPart") { state.bodyPart = "all"; updateActivePill(); }
    if (key === "equipment") { state.equipment = ""; equipmentSelect.value = ""; }
    if (key === "target") { state.target = ""; targetSelect.value = ""; }
    if (key === "search") { state.search = ""; searchInput.value = ""; clearSearchBtn.classList.remove("visible"); }
    applyFilters();
  }

  function resetAllFilters() {
    state.bodyPart = "all"; state.equipment = ""; state.target = ""; state.search = ""; state.sort = "name";
    searchInput.value = ""; equipmentSelect.value = ""; targetSelect.value = ""; sortSelect.value = "name";
    clearSearchBtn.classList.remove("visible");
    setFavoritesOnly(false);
    updateActivePill();
    applyFilters();
  }

  function setFavoritesOnly(val) {
    state.favoritesOnly = val;
    favToggleBtn.setAttribute("aria-pressed", String(val));
    favToggleBtn.classList.toggle("active", val);
    favIconOutline.classList.toggle("hidden", val);
    favIconFilled.classList.toggle("hidden", !val);
  }

  /* ---------------- Grid rendering ---------------- */

  function renderGrid(reset) {
    if (reset) grid.innerHTML = "";
    const start = reset ? 0 : grid.children.length;
    const slice = state.filtered.slice(start, state.visibleCount);
    const frag = document.createDocumentFragment();
    slice.forEach(ex => frag.appendChild(makeCard(ex)));
    grid.appendChild(frag);

    emptyState.classList.toggle("hidden", state.filtered.length !== 0);
    grid.classList.toggle("hidden", state.filtered.length === 0);

    if (reset) setTimeout(() => maybeLoadMore(), 0);
  }

  function makeCard(ex) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = ex.id;

    const icon = BODYPART_ICONS[ex.bodyPart] || "🏋️";
    const fav = isFavorite(ex.id);
    const inWorkout = isInWorkout(ex.id);

    card.innerHTML = `
      <div class="card-media">
        <div class="fallback-icon">${icon}</div>
        <span class="card-bodypart-tag">${ex.bodyPart}</span>
        <div class="card-actions">
          <button class="icon-btn fav-btn${fav ? " active" : ""}" data-id="${ex.id}" aria-label="Toggle favorite">${fav ? "★" : "☆"}</button>
          <button class="icon-btn add-btn${inWorkout ? " active" : ""}" data-id="${ex.id}" aria-label="Add to workout">${inWorkout ? "✓" : "+"}</button>
        </div>
        <canvas class="thumb-canvas"></canvas>
        <img loading="lazy" src="${ex.gif}" alt="${ex.name}">
      </div>
      <div class="card-body">
        <div class="card-title">${ex.name}</div>
        <div class="card-meta">
          <span class="tag target">${ex.target}</span>
          <span class="tag equipment">${ex.equipment}</span>
        </div>
      </div>
    `;

    const img = card.querySelector("img");
    img.addEventListener("load", () => {
      img.classList.add("loaded");
      freezeCardMedia(card, img);
    });
    img.addEventListener("error", () => { img.remove(); });

    return card;
  }

  // Freeze each thumbnail to its first loaded frame (drawn onto a canvas)
  // so 60+ animated GIFs aren't all playing at once in the grid; the real
  // GIF is only shown (and animates) again on hover.
  function freezeCardMedia(card, img) {
    const canvas = card.querySelector(".thumb-canvas");
    const media = card.querySelector(".card-media");
    if (!canvas || !media) return;
    const w = media.clientWidth || 300;
    const h = media.clientHeight || 225;
    const nw = img.naturalWidth, nh = img.naturalHeight;
    if (!nw || !nh) return;

    canvas.width = w;
    canvas.height = h;
    const targetRatio = w / h;
    const srcRatio = nw / nh;
    let sx, sy, sw, sh;
    if (srcRatio > targetRatio) { sh = nh; sw = nh * targetRatio; sx = (nw - sw) / 2; sy = 0; }
    else { sw = nw; sh = nw / targetRatio; sx = 0; sy = (nh - sh) / 2; }

    try {
      canvas.getContext("2d").drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
      canvas.classList.add("ready");
      card.classList.add("frozen");
    } catch { /* drawImage failed — leave the GIF animating, not worth the noise */ }
  }

  grid.addEventListener("click", e => {
    const favBtn = e.target.closest(".fav-btn");
    if (favBtn) { e.stopPropagation(); toggleFavorite(favBtn.dataset.id); return; }
    const addBtn = e.target.closest(".add-btn");
    if (addBtn) { e.stopPropagation(); toggleWorkout(addBtn.dataset.id); return; }
    const card = e.target.closest(".card");
    if (card) {
      const idx = state.filtered.findIndex(x => x.id === card.dataset.id);
      if (idx >= 0) openModal(idx);
    }
  });

  function maybeLoadMore() {
    if (state.visibleCount >= state.filtered.length) return;
    const rect = sentinel.getBoundingClientRect();
    if (rect.top < window.innerHeight + 600) {
      state.visibleCount = Math.min(state.visibleCount + PAGE_SIZE, state.filtered.length);
      renderGrid(false);
    }
  }

  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) maybeLoadMore();
    });
  }, { rootMargin: "600px 0px" });
  io.observe(sentinel);

  // Fallback for environments where IntersectionObserver callbacks are
  // throttled (e.g. background/hidden tabs) — a plain scroll listener
  // guarantees infinite scroll keeps working either way.
  let scrollTicking = false;
  window.addEventListener("scroll", () => {
    if (scrollTicking) return;
    scrollTicking = true;
    setTimeout(() => { maybeLoadMore(); scrollTicking = false; }, 100);
  });

  /* ---------------- Favorites ---------------- */

  function renderFavCount() {
    favCountBadge.textContent = state.favorites.size;
    favCountBadge.classList.toggle("hidden", state.favorites.size === 0);
  }

  function setFavBtnState(btn, active) {
    btn.classList.toggle("active", active);
    btn.textContent = active ? "★" : "☆";
  }

  function setModalFavBtnState(active) {
    modalFavBtn.classList.toggle("active", active);
    modalFavBtn.querySelector(".action-btn-icon").textContent = active ? "★" : "☆";
    modalFavBtn.lastElementChild.textContent = active ? "Favorited" : "Favorite";
  }

  function toggleFavorite(id) {
    if (state.favorites.has(id)) state.favorites.delete(id);
    else state.favorites.add(id);
    saveFavorites();
    renderFavCount();

    const btn = grid.querySelector(`.fav-btn[data-id="${id}"]`);
    if (btn) setFavBtnState(btn, isFavorite(id));
    if (state.filtered[modalIndex] && state.filtered[modalIndex].id === id) {
      setModalFavBtnState(isFavorite(id));
    }
    if (state.favoritesOnly) applyFilters();
  }

  favToggleBtn.addEventListener("click", () => {
    setFavoritesOnly(!state.favoritesOnly);
    applyFilters();
  });

  modalFavBtn.addEventListener("click", () => {
    const ex = state.filtered[modalIndex];
    if (ex) toggleFavorite(ex.id);
  });

  /* ---------------- Workout builder ---------------- */

  function renderWorkoutCount() {
    workoutCountBadge.textContent = state.workout.length;
    workoutCountBadge.classList.toggle("hidden", state.workout.length === 0);
  }

  function setAddBtnState(btn, active) {
    btn.classList.toggle("active", active);
    btn.textContent = active ? "✓" : "+";
  }

  function setModalAddBtnState(active) {
    modalAddBtn.classList.toggle("active", active);
    modalAddBtn.querySelector(".action-btn-icon").textContent = active ? "✓" : "+";
    modalAddBtn.lastElementChild.textContent = active ? "In workout" : "Add to workout";
  }

  function refreshAllWorkoutBadges() {
    grid.querySelectorAll(".add-btn").forEach(btn => setAddBtnState(btn, isInWorkout(btn.dataset.id)));
    if (state.filtered[modalIndex]) setModalAddBtnState(isInWorkout(state.filtered[modalIndex].id));
  }

  function toggleWorkout(id) {
    const idx = state.workout.findIndex(w => w.id === id);
    if (idx >= 0) state.workout.splice(idx, 1);
    else state.workout.push({ id, sets: 3, reps: 10 });
    saveWorkoutDraft();
    renderWorkoutCount();

    const btn = grid.querySelector(`.add-btn[data-id="${id}"]`);
    if (btn) setAddBtnState(btn, isInWorkout(id));
    if (state.filtered[modalIndex] && state.filtered[modalIndex].id === id) {
      setModalAddBtnState(isInWorkout(id));
    }
    renderWorkoutDrawer();
  }

  modalAddBtn.addEventListener("click", () => {
    const ex = state.filtered[modalIndex];
    if (ex) toggleWorkout(ex.id);
  });

  function renderWorkoutDrawer() {
    workoutEmptyState.classList.toggle("hidden", state.workout.length > 0);
    workoutList.classList.toggle("hidden", state.workout.length === 0);
    workoutList.innerHTML = "";

    state.workout.forEach((entry, i) => {
      const ex = exerciseById(entry.id);
      if (!ex) return;
      const li = document.createElement("li");
      li.className = "workout-item";
      li.dataset.id = entry.id;
      li.innerHTML = `
        <img class="workout-item-thumb" src="${ex.gif}" alt="" loading="lazy">
        <div class="workout-item-main">
          <span class="workout-item-name">${ex.name}</span>
          <div class="workout-item-sr">
            <label>Sets <input type="number" class="sr-input" data-field="sets" min="1" max="20" value="${entry.sets}"></label>
            <label>Reps <input type="number" class="sr-input" data-field="reps" min="1" max="100" value="${entry.reps}"></label>
          </div>
        </div>
        <div class="workout-item-controls">
          <button data-action="up" ${i === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
          <button data-action="down" ${i === state.workout.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
          <button data-action="remove" class="workout-item-remove" aria-label="Remove">&times;</button>
        </div>
      `;
      workoutList.appendChild(li);
    });

    workoutStartBtn.disabled = state.workout.length === 0;
    renderSavedWorkoutsList();
  }

  workoutList.addEventListener("click", e => {
    const btn = e.target.closest("button");
    if (!btn) return;
    const li = e.target.closest(".workout-item");
    const id = li.dataset.id;
    const idx = state.workout.findIndex(w => w.id === id);
    if (idx < 0) return;

    if (btn.dataset.action === "remove") {
      state.workout.splice(idx, 1);
      const gridBtn = grid.querySelector(`.add-btn[data-id="${id}"]`);
      if (gridBtn) setAddBtnState(gridBtn, false);
      if (state.filtered[modalIndex] && state.filtered[modalIndex].id === id) setModalAddBtnState(false);
    } else if (btn.dataset.action === "up" && idx > 0) {
      [state.workout[idx - 1], state.workout[idx]] = [state.workout[idx], state.workout[idx - 1]];
    } else if (btn.dataset.action === "down" && idx < state.workout.length - 1) {
      [state.workout[idx + 1], state.workout[idx]] = [state.workout[idx], state.workout[idx + 1]];
    }
    saveWorkoutDraft();
    renderWorkoutCount();
    renderWorkoutDrawer();
  });

  workoutList.addEventListener("change", e => {
    const input = e.target.closest(".sr-input");
    if (!input) return;
    const li = e.target.closest(".workout-item");
    const entry = workoutEntry(li.dataset.id);
    if (!entry) return;
    let val = parseInt(input.value, 10);
    if (!Number.isFinite(val) || val < 1) val = 1;
    entry[input.dataset.field] = val;
    input.value = val;
    saveWorkoutDraft();
  });

  function renderSavedWorkoutsList() {
    const names = Object.keys(state.savedWorkouts);
    savedWorkoutsList.innerHTML = "";
    if (!names.length) {
      savedWorkoutsList.innerHTML = `<div class="saved-workouts-empty">No saved workouts yet.</div>`;
      return;
    }
    names.forEach(name => {
      const ids = state.savedWorkouts[name];
      const row = document.createElement("div");
      row.className = "saved-workout-row";
      row.innerHTML = `
        <button class="saved-workout-name">${name}</button>
        <span class="saved-workout-count">${ids.length}</span>
        <button class="saved-workout-delete" aria-label="Delete saved workout">&times;</button>
      `;
      row.querySelector(".saved-workout-name").addEventListener("click", () => loadSavedWorkout(name));
      row.querySelector(".saved-workout-delete").addEventListener("click", () => deleteSavedWorkout(name));
      savedWorkoutsList.appendChild(row);
    });
  }

  function loadSavedWorkout(name) {
    const entries = state.savedWorkouts[name];
    if (!entries) return;
    state.workout = entries.map(e => ({ ...e }));
    saveWorkoutDraft();
    renderWorkoutCount();
    renderWorkoutDrawer();
    refreshAllWorkoutBadges();
  }

  function deleteSavedWorkout(name) {
    delete state.savedWorkouts[name];
    saveSavedWorkouts();
    renderSavedWorkoutsList();
  }

  workoutSaveBtn.addEventListener("click", () => {
    const name = workoutNameInput.value.trim();
    if (!name || state.workout.length === 0) return;
    state.savedWorkouts[name] = state.workout.map(e => ({ ...e }));
    saveSavedWorkouts();
    workoutNameInput.value = "";
    renderSavedWorkoutsList();
  });
  workoutNameInput.addEventListener("keydown", e => { if (e.key === "Enter") workoutSaveBtn.click(); });

  workoutClearBtn.addEventListener("click", () => {
    state.workout = [];
    saveWorkoutDraft();
    renderWorkoutCount();
    renderWorkoutDrawer();
    refreshAllWorkoutBadges();
  });

  function openWorkoutDrawer() {
    renderWorkoutDrawer();
    workoutDrawerOverlay.classList.remove("hidden");
    setTimeout(() => workoutDrawerOverlay.classList.add("visible"), 10);
    document.body.classList.add("modal-open");
  }
  function closeWorkoutDrawer() {
    workoutDrawerOverlay.classList.remove("visible");
    document.body.classList.remove("modal-open");
    setTimeout(() => workoutDrawerOverlay.classList.add("hidden"), 250);
  }
  workoutToggleBtn.addEventListener("click", openWorkoutDrawer);
  workoutDrawerClose.addEventListener("click", closeWorkoutDrawer);
  workoutDrawerOverlay.addEventListener("click", e => { if (e.target === workoutDrawerOverlay) closeWorkoutDrawer(); });

  /* ---------------- Share link ---------------- */

  function encodeWorkoutParam(workout) {
    return workout.map(w => `${w.id}-${w.sets}-${w.reps}`).join(",");
  }

  function decodeWorkoutParam(str) {
    return str.split(",").map(part => {
      const [id, sets, reps] = part.split("-");
      if (!id) return null;
      const s = parseInt(sets, 10), r = parseInt(reps, 10);
      return { id, sets: s > 0 ? s : 3, reps: r > 0 ? r : 10 };
    }).filter(Boolean);
  }

  async function copyShareLink() {
    if (state.workout.length === 0) return;
    const url = `${location.origin}${location.pathname}?w=${encodeWorkoutParam(state.workout)}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { copied = document.execCommand("copy"); } catch { copied = false; }
      ta.remove();
    }
    const original = workoutShareBtn.textContent;
    workoutShareBtn.textContent = copied ? "✅" : "⚠️";
    workoutShareBtn.disabled = true;
    setTimeout(() => { workoutShareBtn.textContent = original; workoutShareBtn.disabled = false; }, 1600);
  }
  workoutShareBtn.addEventListener("click", copyShareLink);

  function checkForSharedWorkout() {
    const params = new URLSearchParams(location.search);
    const w = params.get("w");
    if (!w) return;
    const entries = decodeWorkoutParam(w).filter(e => exerciseById(e.id));
    if (!entries.length) return;
    pendingSharedWorkout = entries;
    sharedBannerText.textContent = `A trainer shared a workout with ${entries.length} exercise${entries.length === 1 ? "" : "s"}.`;
    sharedWorkoutBanner.classList.remove("hidden");
  }

  function dismissSharedBanner() {
    sharedWorkoutBanner.classList.add("hidden");
    pendingSharedWorkout = null;
    const url = new URL(location.href);
    url.searchParams.delete("w");
    history.replaceState({}, "", url);
  }

  sharedBannerImport.addEventListener("click", () => {
    if (!pendingSharedWorkout) return;
    state.workout = pendingSharedWorkout.map(e => ({ ...e }));
    saveWorkoutDraft();
    renderWorkoutCount();
    refreshAllWorkoutBadges();
    dismissSharedBanner();
    openWorkoutDrawer();
  });
  sharedBannerDismiss.addEventListener("click", dismissSharedBanner);

  /* ---------------- Workout mode ---------------- */

  let wmExercises = [];
  let wmIndex = 0;
  let restInterval = null;
  let restSeconds = 60;

  function startWorkoutMode() {
    wmExercises = state.workout.map(entry => {
      const ex = exerciseById(entry.id);
      return ex ? { ...ex, sets: entry.sets, reps: entry.reps } : null;
    }).filter(Boolean);
    if (!wmExercises.length) return;
    wmIndex = 0;
    closeWorkoutDrawer();
    renderWorkoutModeStep();
    workoutModeOverlay.classList.remove("hidden");
    setTimeout(() => workoutModeOverlay.classList.add("visible"), 10);
    document.body.style.overflow = "hidden";
  }

  function exitWorkoutMode() {
    stopRestTimer();
    workoutModeOverlay.classList.remove("visible");
    setTimeout(() => workoutModeOverlay.classList.add("hidden"), 200);
    document.body.style.overflow = "";
  }

  function renderWorkoutModeStep() {
    const ex = wmExercises[wmIndex];
    if (!ex) return;
    wmPosition.textContent = `Exercise ${wmIndex + 1} of ${wmExercises.length}`;
    wmProgressFill.style.width = `${(wmIndex / wmExercises.length) * 100}%`;
    wmTitle.textContent = ex.name;
    wmImg.src = ex.gif;
    wmImg.alt = ex.name;
    wmBadges.innerHTML = `
      <span class="tag target">${ex.target}</span>
      <span class="tag equipment">${ex.equipment}</span>
      <span class="tag equipment">${ex.bodyPart}</span>
    `;
    wmSetsReps.textContent = `${ex.sets} sets × ${ex.reps} reps`;
    wmInstructions.innerHTML = ex.instructions.length
      ? ex.instructions.map(step => `<li>${step}</li>`).join("")
      : `<li>No instructions listed.</li>`;
    wmPrevBtn.disabled = wmIndex === 0;
    wmNextBtn.textContent = wmIndex === wmExercises.length - 1 ? "Finish" : "Next";
  }

  wmPrevBtn.addEventListener("click", () => {
    stopRestTimer();
    if (wmIndex > 0) { wmIndex--; renderWorkoutModeStep(); }
  });
  wmNextBtn.addEventListener("click", () => {
    stopRestTimer();
    if (wmIndex < wmExercises.length - 1) { wmIndex++; renderWorkoutModeStep(); }
    else finishWorkout();
  });
  wmExitBtn.addEventListener("click", exitWorkoutMode);

  function finishWorkout() {
    exitWorkoutMode();
    wmDoneSummary.textContent = `You completed ${wmExercises.length} exercise${wmExercises.length === 1 ? "" : "s"}. Nice work.`;
    wmDoneOverlay.classList.remove("hidden");
    setTimeout(() => wmDoneOverlay.classList.add("visible"), 10);
  }
  wmDoneCloseBtn.addEventListener("click", () => {
    wmDoneOverlay.classList.remove("visible");
    setTimeout(() => wmDoneOverlay.classList.add("hidden"), 200);
  });

  function updateRestDisplay() { wmRestTime.textContent = restSeconds; }
  function startRestTimer() {
    restSeconds = 60;
    updateRestDisplay();
    wmRestOverlay.classList.remove("hidden");
    clearInterval(restInterval);
    restInterval = setInterval(() => {
      restSeconds--;
      if (restSeconds <= 0) { stopRestTimer(); return; }
      updateRestDisplay();
    }, 1000);
  }
  function stopRestTimer() {
    clearInterval(restInterval);
    restInterval = null;
    wmRestOverlay.classList.add("hidden");
  }
  wmRestBtn.addEventListener("click", startRestTimer);
  wmRestSkip.addEventListener("click", stopRestTimer);
  wmRestPlus.addEventListener("click", () => { restSeconds += 15; updateRestDisplay(); });
  wmRestMinus.addEventListener("click", () => { restSeconds = Math.max(5, restSeconds - 15); updateRestDisplay(); });

  workoutStartBtn.addEventListener("click", startWorkoutMode);

  /* ---------------- Modal ---------------- */

  function openModal(index) {
    modalIndex = index;
    renderModal();
    modalOverlay.classList.remove("hidden");
    setTimeout(() => modalOverlay.classList.add("visible"), 10);
    document.body.style.overflow = "hidden";
    document.body.classList.add("modal-open");
  }

  function closeModal() {
    modalOverlay.classList.remove("visible");
    document.body.style.overflow = "";
    document.body.classList.remove("modal-open");
    setTimeout(() => modalOverlay.classList.add("hidden"), 180);
  }

  function renderModal() {
    const ex = state.filtered[modalIndex];
    if (!ex) return;

    modalPosition.textContent = `Exercise ${modalIndex + 1} of ${state.filtered.length}`;
    modalTitle.textContent = ex.name;
    modalImg.src = ex.gif;
    modalImg.alt = ex.name;
    modalImg.onerror = () => { modalImg.style.display = "none"; };
    modalImg.onload = () => { modalImg.style.display = ""; };

    modalBadges.innerHTML = `
      <span class="tag target">${ex.target}</span>
      <span class="tag equipment">${ex.equipment}</span>
      <span class="tag equipment">${ex.bodyPart}</span>
    `;

    setModalFavBtnState(isFavorite(ex.id));
    setModalAddBtnState(isInWorkout(ex.id));

    modalSecondary.innerHTML = ex.secondaryMuscles.length
      ? ex.secondaryMuscles.map(m => `<span class="tag target">${m}</span>`).join("")
      : `<span class="tag equipment">None listed</span>`;

    modalInstructions.innerHTML = ex.instructions.length
      ? ex.instructions.map(step => `<li>${step}</li>`).join("")
      : `<li>No instructions listed.</li>`;

    modalPrev.disabled = modalIndex <= 0;
    modalNext.disabled = modalIndex >= state.filtered.length - 1;

    // keep more cards loaded so "next" always has data
    if (modalIndex + 5 > state.visibleCount && state.visibleCount < state.filtered.length) {
      state.visibleCount = Math.min(state.visibleCount + PAGE_SIZE, state.filtered.length);
      renderGrid(false);
    }
  }

  modalClose.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", e => { if (e.target === modalOverlay) closeModal(); });
  modalPrev.addEventListener("click", () => { if (modalIndex > 0) { modalIndex--; renderModal(); } });
  modalNext.addEventListener("click", () => { if (modalIndex < state.filtered.length - 1) { modalIndex++; renderModal(); } });

  document.addEventListener("keydown", e => {
    if (!workoutModeOverlay.classList.contains("hidden")) {
      if (e.key === "Escape") {
        if (!wmRestOverlay.classList.contains("hidden")) stopRestTimer();
        else exitWorkoutMode();
      }
      if (e.key === "ArrowLeft") wmPrevBtn.click();
      if (e.key === "ArrowRight") wmNextBtn.click();
      return;
    }
    if (!workoutDrawerOverlay.classList.contains("hidden")) {
      if (e.key === "Escape") closeWorkoutDrawer();
      return;
    }
    if (!modalOverlay.classList.contains("hidden")) {
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") modalPrev.click();
      if (e.key === "ArrowRight") modalNext.click();
      return;
    }
    if (e.key === "/") {
      const tag = document.activeElement.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      e.preventDefault();
      searchInput.focus();
    }
  });

  // Swipe left/right to navigate prev/next on touch devices.
  function addSwipeNav(el, prevBtn, nextBtn) {
    let startX = null;
    el.addEventListener("touchstart", e => { startX = e.touches[0].clientX; }, { passive: true });
    el.addEventListener("touchend", e => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      startX = null;
      if (Math.abs(dx) < 50) return;
      if (dx > 0) prevBtn.click(); else nextBtn.click();
    }, { passive: true });
  }
  addSwipeNav(modalOverlay, modalPrev, modalNext);
  addSwipeNav(workoutModeOverlay, wmPrevBtn, wmNextBtn);

  /* ---------------- Controls ---------------- */

  let searchDebounce;
  searchInput.addEventListener("input", () => {
    clearSearchBtn.classList.toggle("visible", searchInput.value.length > 0);
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      state.search = searchInput.value;
      applyFilters();
    }, 150);
  });
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearSearchBtn.classList.remove("visible");
    state.search = "";
    applyFilters();
    searchInput.focus();
  });

  filterToggleBtn.addEventListener("click", () => {
    const open = filterPanel.classList.toggle("open");
    filterToggleBtn.setAttribute("aria-expanded", String(open));
  });

  equipmentSelect.addEventListener("change", () => { state.equipment = equipmentSelect.value; applyFilters(); });
  targetSelect.addEventListener("change", () => { state.target = targetSelect.value; applyFilters(); });
  sortSelect.addEventListener("change", () => { state.sort = sortSelect.value; applyFilters(); });
  resetFiltersBtn.addEventListener("click", resetAllFilters);
  emptyResetBtn.addEventListener("click", resetAllFilters);

  window.addEventListener("scroll", () => {
    backToTop.classList.toggle("visible", window.scrollY > 600);
  });
  backToTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------------- Theme ---------------- */

  function applyTheme(theme) {
    if (theme) document.documentElement.setAttribute("data-theme", theme);
    else document.documentElement.removeAttribute("data-theme");
    themeIconSun.classList.toggle("hidden", theme === "dark");
    themeIconMoon.classList.toggle("hidden", theme !== "dark");
  }

  const savedTheme = localStorage.getItem("exlib-theme");
  if (savedTheme) applyTheme(savedTheme);
  else {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    themeIconMoon.classList.toggle("hidden", !prefersDark);
    themeIconSun.classList.toggle("hidden", prefersDark);
  }

  themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme")
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    applyTheme(next);
    localStorage.setItem("exlib-theme", next);
  });

  /* ---------------- PWA / offline ---------------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(() => {});
    });
  }
})();
