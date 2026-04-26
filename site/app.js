(() => {
  const quoteEl = document.getElementById("quote-text");
  const sourceEl = document.getElementById("quote-source");
  const counterEl = document.getElementById("quote-counter");
  const nextBtn = document.getElementById("next-btn");
  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));

  const STORAGE_KEY = "citater-mode";
  const VALID_MODES = new Set(["both", "original", "ai"]);
  const DEFAULT_MODE = "both";

  const SOURCE_LABEL = {
    "original": "autentisk",
    "ai": "ai-genereret",
  };

  // Forkortet visningsnavn for AI-sektioner — sektionsnavnene i kildefilen
  // er beskrivende, men typisk for lange som chip-label.
  const SECTION_LABEL = {
    "forbrugerteori og nytte": "forbrugerteori",
    "produktion og omkostninger": "produktion",
    "spilteori": "spilteori",
    "mekanismedesign og auktioner": "mekanismedesign",
    "information og incitamenter": "information",
    "forsikring og risiko": "forsikring",
    "bankvæsen og kriser": "bankvæsen",
    "markedsstruktur og monopol": "markedsstruktur",
    "velfærdsøkonomi og politik": "velfærdsøkonomi",
    "eksternaliteter og miljø": "miljø",
    "arbejdsmarked": "arbejdsmarked",
    "navngivne danske politikere og økonomer": "danske politikere",
    "koloni og historisk register": "koloni",
    "dødshumor som økonomisk illustration": "dødshumor",
    "økonomifaget og akademiet": "akademia",
  };

  let allQuotes = [];
  let pool = [];          // Aktuel shufflet pulje (filteret på mode)
  let poolIndex = 0;      // Antal vist fra puljen indtil videre
  let mode = readMode();
  let currentQuote = null;
  let updatingFromHash = false;

  function readMode() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_MODES.has(stored) ? stored : DEFAULT_MODE;
  }

  function getFilteredQuotes() {
    if (mode === "both") return allQuotes;
    return allQuotes.filter((q) => q.source === mode);
  }

  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  function rebuildPool(firstQuote = null) {
    pool = [...getFilteredQuotes()];
    shuffleArray(pool);
    if (firstQuote) {
      const idx = pool.findIndex((q) => q.id === firstQuote.id);
      if (idx >= 0) pool.splice(idx, 1);
      pool.unshift(firstQuote);
    }
    poolIndex = 0;
  }

  function showNextFromPool(immediate = false) {
    if (pool.length === 0) {
      renderEmpty();
      return;
    }
    if (poolIndex >= pool.length) {
      // Pulje udtømt — reshuffle. Undgå umiddelbar gentagelse hvis muligt.
      const lastShown = currentQuote;
      rebuildPool();
      if (lastShown && pool.length > 1 && pool[0].id === lastShown.id) {
        const j = 1 + Math.floor(Math.random() * (pool.length - 1));
        [pool[0], pool[j]] = [pool[j], pool[0]];
      }
    }
    const q = pool[poolIndex];
    poolIndex++;
    currentQuote = q;
    updateURL(q);
    render(q, !immediate);
    updateCounter();
  }

  function showQuoteById(id, immediate = false) {
    const q = allQuotes.find((x) => x.id === id);
    if (!q) return false;

    // Hvis citatet ikke er i nuværende filter, skift til "both" (uden persistens
    // — brugeren skal selv re-toggle for at gemme præferencen)
    if (mode !== "both" && q.source !== mode) {
      mode = "both";
      syncModeButtons();
    }

    rebuildPool(q);
    showNextFromPool(immediate);
    return true;
  }

  function render(q, animate = true) {
    const sourceText = formatSource(q);
    const renderImpl = () => {
      quoteEl.textContent = q.text;
      sourceEl.textContent = sourceText;
      quoteEl.classList.remove("fading");
    };
    if (!animate) {
      renderImpl();
      return;
    }
    quoteEl.classList.add("fading");
    setTimeout(renderImpl, 180);
  }

  function renderEmpty() {
    quoteEl.textContent = "Ingen citater i denne kategori.";
    sourceEl.textContent = "";
    counterEl.textContent = "";
  }

  function formatSource(q) {
    const src = SOURCE_LABEL[q.source] || q.source;
    if (q.section) {
      const short = SECTION_LABEL[q.section] || q.section;
      return `${src} · ${short}`;
    }
    return src;
  }

  function updateCounter() {
    if (pool.length === 0) {
      counterEl.textContent = "";
      return;
    }
    counterEl.textContent = `${poolIndex} / ${pool.length}`;
  }

  function updateURL(q) {
    if (updatingFromHash) return;
    const newHash = `#${q.id}`;
    if (location.hash !== newHash) {
      // replaceState — opdaterer URL'en uden at fylde history op.
      // Permalinks virker stadig for sharing.
      history.replaceState(null, "", newHash);
    }
  }

  function syncModeButtons() {
    for (const btn of modeButtons) {
      btn.setAttribute(
        "aria-checked",
        btn.dataset.mode === mode ? "true" : "false",
      );
    }
  }

  function setMode(newMode) {
    if (!VALID_MODES.has(newMode) || newMode === mode) return;
    mode = newMode;
    localStorage.setItem(STORAGE_KEY, mode);
    syncModeButtons();
    rebuildPool();
    showNextFromPool();
  }

  async function loadQuotes() {
    try {
      const resp = await fetch("quotes.json", { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      allQuotes = await resp.json();
    } catch (err) {
      console.error("Kunne ikke indlæse citater:", err);
      quoteEl.textContent = "Kunne ikke indlæse citater. Prøv at genindlæse siden.";
      nextBtn.disabled = true;
    }
  }

  // Event listeners
  nextBtn.addEventListener("click", () => showNextFromPool());

  for (const btn of modeButtons) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      showNextFromPool();
    }
  });

  // Reager på manuel hash-ændring (delete af hash, paste af nyt URL)
  window.addEventListener("hashchange", () => {
    const id = location.hash.replace(/^#/, "");
    if (!id) return;
    if (currentQuote && currentQuote.id === id) return;
    updatingFromHash = true;
    showQuoteById(id, false);
    updatingFromHash = false;
  });

  // Init
  syncModeButtons();
  (async () => {
    await loadQuotes();
    if (allQuotes.length === 0) return;

    const hashId = location.hash.replace(/^#/, "");
    if (hashId && showQuoteById(hashId, true)) return;

    rebuildPool();
    showNextFromPool(true);
  })();
})();
