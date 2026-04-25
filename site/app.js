(() => {
  const quoteEl = document.getElementById("quote-text");
  const sourceEl = document.getElementById("quote-source");
  const btn = document.getElementById("next-btn");

  let quotes = [];
  let lastIdx = -1;

  const SOURCE_LABEL = {
    "original": "autentisk",
    "ai": "ai-genereret",
  };

  async function loadQuotes() {
    try {
      const resp = await fetch("quotes.json", { cache: "no-cache" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      quotes = await resp.json();
    } catch (err) {
      console.error("Kunne ikke indlæse citater:", err);
      quoteEl.textContent = "Kunne ikke indlæse citater. Prøv at genindlæse siden.";
      btn.disabled = true;
    }
  }

  function pickRandomIndex() {
    if (quotes.length <= 1) return 0;
    let idx;
    do {
      idx = Math.floor(Math.random() * quotes.length);
    } while (idx === lastIdx);
    return idx;
  }

  function showQuote(immediate = false) {
    if (quotes.length === 0) return;

    const idx = pickRandomIndex();
    lastIdx = idx;
    const q = quotes[idx];

    const render = () => {
      quoteEl.textContent = q.text;
      sourceEl.textContent = SOURCE_LABEL[q.source] || q.source;
      quoteEl.classList.remove("fading");
    };

    if (immediate) {
      render();
    } else {
      quoteEl.classList.add("fading");
      setTimeout(render, 180);
    }
  }

  btn.addEventListener("click", () => showQuote(false));

  // Tastatur-genvej: mellemrum eller pil-højre = næste citat
  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") {
      e.preventDefault();
      showQuote(false);
    }
  });

  (async () => {
    await loadQuotes();
    if (quotes.length > 0) showQuote(true);
  })();
})();
