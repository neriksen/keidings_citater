(() => {
  const quoteEl = document.getElementById("quote-text");
  const sourceEl = document.getElementById("quote-source");
  const nextBtn = document.getElementById("next-btn");
  const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));

  const STORAGE_KEY = "citater-mode";
  const VALID_MODES = new Set(["both", "original", "ai"]);
  const DEFAULT_MODE = "both";

  const SOURCE_LABEL = {
    "original": "autentisk",
    "ai": "ai-genereret",
  };

  let quotes = [];
  let lastQuote = null;
  let mode = readMode();

  function readMode() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_MODES.has(stored) ? stored : DEFAULT_MODE;
  }

  function getFilteredPool() {
    if (mode === "both") return quotes;
    return quotes.filter((q) => q.source === mode);
  }

  function pickRandomQuote(pool) {
    if (pool.length === 0) return null;
    if (pool.length === 1) return pool[0];
    let q;
    do {
      q = pool[Math.floor(Math.random() * pool.length)];
    } while (q === lastQuote);
    return q;
  }

  function renderQuote(q) {
    if (q === null) {
      quoteEl.textContent = "Ingen citater i denne kategori.";
      sourceEl.textContent = "";
      return;
    }
    quoteEl.textContent = q.text;
    sourceEl.textContent = SOURCE_LABEL[q.source] || q.source;
  }

  function showQuote(immediate = false) {
    const pool = getFilteredPool();
    const q = pickRandomQuote(pool);
    lastQuote = q;

    if (immediate || q === null) {
      renderQuote(q);
      quoteEl.classList.remove("fading");
      return;
    }

    quoteEl.classList.add("fading");
    setTimeout(() => {
      renderQuote(q);
      quoteEl.classList.remove("fading");
    }, 180);
  }

  function syncModeButtons() {
    for (const btn of modeButtons) {
      btn.setAttribute("aria-checked", btn.dataset.mode === mode ? "true" : "false");
    }
  }

  function setMode(newMode) {
    if (!VALID_MODES.has(newMode) || newMode === mode) return;
    mode = newMode;
    localStorage.setItem(STORAGE_KEY, mode);
    syncModeButtons();
    showQuote(false);
  }

  async function loadQuotes() {
    try {
      const resp = await fetch("quotes.json", { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      quotes = await resp.json();
    } catch (err) {
      console.error("Kunne ikke indlæse citater:", err);
      quoteEl.textContent = "Kunne ikke indlæse citater. Prøv at genindlæse siden.";
      nextBtn.disabled = true;
    }
  }

  // Wire up controls
  nextBtn.addEventListener("click", () => showQuote(false));

  for (const btn of modeButtons) {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  }

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      showQuote(false);
    }
  });

  // Init
  syncModeButtons();
  (async () => {
    await loadQuotes();
    if (quotes.length > 0) showQuote(true);
  })();
})();
