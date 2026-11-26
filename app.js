(() => {
  "use strict";
  const CFG = window.BUNZELFA || {};
  const $ = (s, r = document) => r.querySelector(s);
  const LS = {
    get(k, d) { try { const v = localStorage.getItem("bz." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem("bz." + k, JSON.stringify(v)); } catch {} }
  };
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let me = LS.get("name", null);

  /* ---------- cielo e neve ---------- */
  const sky = $("#sky");
  for (let i = 0; i < 60; i++) {
    const s = document.createElement("i");
    s.className = "star";
    s.style.left = Math.random() * 100 + "%";
    s.style.top = Math.random() * 55 + "%";
    s.style.animationDelay = (Math.random() * 3).toFixed(2) + "s";
    if (Math.random() < .2) { s.style.width = s.style.height = "3px"; }
    sky.appendChild(s);
  }
  const snow = $("#snow");
  for (let i = 0; i < 36; i++) {
    const f = document.createElement("span");
    f.className = "flake";
    f.textContent = Math.random() < .5 ? "❄" : "•";
    f.style.left = Math.random() * 100 + "%";
    f.style.fontSize = (6 + Math.random() * 12).toFixed(0) + "px";
    f.style.setProperty("--dx", (Math.random() * 80 - 40).toFixed(0) + "px");
    f.style.animationDuration = (8 + Math.random() * 10).toFixed(1) + "s";
    f.style.animationDelay = (-Math.random() * 18).toFixed(1) + "s";
    snow.appendChild(f);
  }

  /* ---------- fumetto della Bunzelfa ---------- */
  const bubble = $("#bubble");
  function say(html) {
    bubble.innerHTML = html;
    bubble.classList.remove("pop"); void bubble.offsetWidth; bubble.classList.add("pop");
  }
  function greet() {
    if (!me) say("Ciao! Io sono la <b>Bunzelfa</b>, la tua elfa personale. Chi sei?");
    else say(`Ciao <b>${esc(me)}</b>! 🎄 Scrivimi i tuoi desideri: li porto io a Babbo Natale.`);
    $("#sign").textContent = "Con tanto affetto, " + (me || "…");
    $("#sentWho").textContent = me ? `Quello che ${me} ha già chiesto alla Bunzelfa da questo telefono.` : "Quello che hai già chiesto alla Bunzelfa da questo telefono.";
  }

  /* ---------- chi sei ---------- */
  const namesBox = $("#names");
  (CFG.people || []).forEach(p => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "name"; b.dataset.name = p.name;
    b.innerHTML = `<span class="av">${esc(p.emoji)}</span>${esc(p.name)}`;
    b.setAttribute("aria-pressed", String(p.name === me));
    b.addEventListener("click", () => {
      me = p.name; LS.set("name", me);
      namesBox.querySelectorAll(".name").forEach(x => x.setAttribute("aria-pressed", String(x.dataset.name === me)));
      greet(); renderSent();
      const first = $("#wishes input");
      if (first && !first.value) setTimeout(() => first.focus({ preventScroll: false }), 150);
    });
    namesBox.appendChild(b);
  });

  /* ---------- desideri ---------- */
  const wishes = $("#wishes");
  function addWish(text = "", link = "") {
    const li = document.createElement("li");
    li.className = "wish";
    li.innerHTML = `
      <input class="txt" type="text" maxlength="200" placeholder="Cosa desideri?" aria-label="Desiderio">
      <input class="link" type="url" inputmode="url" autocapitalize="off" autocorrect="off" maxlength="600" placeholder="🔗 Link (facoltativo)" aria-label="Link del desiderio">
      <button type="button" class="rm" aria-label="Togli questo desiderio">✕</button>`;
    $(".txt", li).value = text; $(".link", li).value = link;
    $(".rm", li).addEventListener("click", () => {
      if (wishes.children.length > 1) li.remove(); else { $(".txt", li).value = ""; $(".link", li).value = ""; }
      saveDraft();
    });
    li.addEventListener("input", saveDraft);
    wishes.appendChild(li);
    return li;
  }
  function readWishes() {
    return [...wishes.querySelectorAll(".wish")].map(li => ({
      text: $(".txt", li).value.trim(),
      link: normLink($(".link", li).value)
    })).filter(w => w.text || w.link);
  }
  function normLink(v) {
    v = v.trim(); if (!v) return "";
    if (!/^https?:\/\//i.test(v)) v = "https://" + v;
    try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch { return ""; }
  }
  function saveDraft() {
    LS.set("draft", [...wishes.querySelectorAll(".wish")].map(li => ({ text: $(".txt", li).value, link: $(".link", li).value })));
  }
  const draft = LS.get("draft", []);
  if (draft.length) draft.forEach(w => addWish(w.text, w.link)); else { addWish(); addWish(); }
  $("#addWish").addEventListener("click", () => { $(".txt", addWish()).focus(); saveDraft(); });

  /* ---------- invio con coda (funziona anche senza rete) ---------- */
  function queue() { return LS.get("queue", []); }
  async function post(item) {
    if (!CFG.endpoint) throw new Error("no-endpoint");
    // text/plain = nessun preflight CORS verso Apps Script
    const r = await fetch(CFG.endpoint, { method: "POST", body: JSON.stringify({ ...item, key: CFG.key }), redirect: "follow" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.ok === false) throw new Error(j.error || "http " + r.status);
    return j;
  }
  let flushing = false;
  async function flush() {
    if (flushing) return; flushing = true;
    try {
      let q = queue();
      for (const item of q) {
        try {
          await post(item);
          q = queue().filter(x => x.id !== item.id); LS.set("queue", q);
          const hist = LS.get("sent", []); const h = hist.find(x => x.id === item.id); if (h) { h.status = "ok"; LS.set("sent", hist); }
        } catch { break; }
      }
    } finally { flushing = false; renderSent(); }
  }
  async function send(item) {
    LS.set("queue", [...queue(), item]);
    LS.set("sent", [{ ...item, status: "wait" }, ...LS.get("sent", [])].slice(0, 100));
    await flush();
    return !queue().some(x => x.id === item.id);
  }
  window.addEventListener("online", flush);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) flush(); });

  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2800); }
  function fly() { const s = $("#sleigh"); s.classList.remove("go"); void s.getBoundingClientRect(); s.classList.add("go"); }

  $("#letterForm").addEventListener("submit", async e => {
    e.preventDefault();
    const hint = $("#letterHint"); hint.className = "hint";
    if (!me) { hint.textContent = "Prima dimmi chi sei! 👆"; hint.classList.add("err"); say("Ehi, prima dimmi <b>chi sei</b>! 🙂"); namesBox.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
    const list = readWishes();
    if (!list.length) { hint.textContent = "Scrivi almeno un desiderio ✏️"; hint.classList.add("err"); return; }
    const btn = $("#sendLetter"); btn.disabled = true;
    const ok = await send({ id: uid(), type: "letter", name: me, wishes: list, sentAt: new Date().toISOString() });
    btn.disabled = false;
    wishes.innerHTML = ""; addWish(); addWish(); saveDraft();
    fly();
    if (ok) { hint.textContent = ""; say(`Ricevuta, <b>${esc(me)}</b>! ✨ Le renne stanno già volando da Babbo Natale.`); toast("Letterina consegnata alla Bunzelfa 🎅"); }
    else { hint.textContent = "Niente rete: la Bunzelfa la consegna appena torna la connessione."; say("L'ho messa nella mia borsa 👜 La consegno appena c'è campo!"); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("#msgForm").addEventListener("submit", async e => {
    e.preventDefault();
    const hint = $("#msgHint"); hint.className = "hint";
    const text = $("#msgText").value.trim();
    if (!me) { hint.textContent = "Prima scegli chi sei nella tab Letterina 🎄"; hint.classList.add("err"); return; }
    if (!text) { hint.textContent = "Scrivi qualcosa alla Bunzelfa ✏️"; hint.classList.add("err"); return; }
    const btn = $("#sendMsg"); btn.disabled = true;
    const ok = await send({ id: uid(), type: "message", name: me, text, sentAt: new Date().toISOString() });
    btn.disabled = false; $("#msgText").value = ""; LS.set("msgDraft", "");
    hint.textContent = ok ? "Messaggino arrivato! La Bunzelfa ti manda un abbraccio 🤗" : "Niente rete: lo consegno appena torna la connessione.";
    if (ok) toast("Messaggino consegnato 💌");
  });
  $("#msgText").value = LS.get("msgDraft", "");
  $("#msgText").addEventListener("input", e => LS.set("msgDraft", e.target.value));

  /* ---------- inviate ---------- */
  function fmt(iso) { try { return new Date(iso).toLocaleString("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); } catch { return ""; } }
  function renderSent() {
    const box = $("#sentList");
    const hist = LS.get("sent", []).filter(x => !me || x.name === me);
    if (!hist.length) { box.innerHTML = `<p class="empty">Ancora niente… la Bunzelfa aspetta la tua letterina! 🧝‍♀️</p>`; return; }
    box.innerHTML = hist.map(h => {
      const pill = h.status === "ok" ? `<span class="pill ok">consegnata</span>` : `<span class="pill wait">in viaggio</span>`;
      const head = `<h3>${h.type === "letter" ? "✉️ Letterina" : "💌 Messaggino"} <small>${esc(fmt(h.sentAt))}</small> ${pill}</h3>`;
      if (h.type === "message") return `<div class="card">${head}<p>${esc(h.text)}</p></div>`;
      return `<div class="card">${head}<ul>${h.wishes.map(w =>
        `<li>${esc(w.text || "(senza nome)")}${w.link && /^https:\/\//i.test(w.link) ? ` · <a href="${esc(w.link)}" target="_blank" rel="noopener">link</a>` : ""}</li>`).join("")}</ul></div>`;
    }).join("");
  }

  /* ---------- tab ---------- */
  document.querySelectorAll(".tabbar button").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".tabbar button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    document.querySelectorAll(".tab").forEach(t => { t.hidden = t.id !== b.dataset.tab; });
    if (b.dataset.tab === "tab-sent") renderSent();
    window.scrollTo(0, 0);
  }));

  greet(); renderSent(); flush();

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
})();
