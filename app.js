"use strict";

const USERNAME = "retkeilija";
const DEFAULT_PW = "metsa2026";

const THEMES = {
  raikas: { bg: "#eef3ea", surface: "#ffffff", ink: "#1b2a20", sub: "#63715f", line: "#e6ece2", accent: "#2f9e44", accentSoft: "#e9f4ec", visited: "#2f9e44", unvisited: "#b9c1b9", shadow: "0 6px 28px rgba(28,46,32,.12)" },
  utua: { bg: "#eef1f5", surface: "#ffffff", ink: "#1e2a35", sub: "#5f6b78", line: "#e3e8ee", accent: "#2f9e44", accentSoft: "#e7f3ea", visited: "#2f9e44", unvisited: "#bcc4cc", shadow: "0 6px 28px rgba(30,42,53,.12)" },
  ruska: { bg: "#f6efe6", surface: "#fffdfa", ink: "#2b2419", sub: "#736451", line: "#ece2d4", accent: "#2f9e44", accentSoft: "#eaf4ea", visited: "#2f9e44", unvisited: "#c9bda9", shadow: "0 6px 28px rgba(60,44,26,.13)" }
};
const THEME_SWATCH_COLOR = { raikas: "#eef3ea", utua: "#e3e8ee", ruska: "#f0e4d2" };
const TILES = {
  raikas: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  utua: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
  ruska: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
}

class KansallispuistotApp {
  constructor() {
    this.state = {
      parks: [], visited: {}, loaded: false, selectedId: null, query: "",
      filter: "all", theme: "raikas", images: {},
      user: localStorage.getItem("kp_session") ? USERNAME : null,
      authOpen: false, authError: "",
      pwOpen: false, pwError: "", pwSuccess: "",
      drawerOpen: false
    };
    this.map = null; this.tileLayer = null; this.markers = {};
    this.busy = false; this.queue = [];

    this.cacheEls();
    this.bindEvents();
    this.applyTheme(this.state.theme);
    this.renderSwatches();
    this.renderAuthBox();
    this.loadData();
    window.addEventListener("resize", () => { if (this.map) this.map.invalidateSize(); });
  }

  cacheEls() {
    this.el = {
      root: document.getElementById("root"),
      drawerToggle: document.getElementById("drawerToggle"),
      backdrop: document.getElementById("backdrop"),
      aside: document.getElementById("aside"),
      authBox: document.getElementById("authBox"),
      topbarVisited: document.getElementById("topbarVisited"),
      topbarTotal: document.getElementById("topbarTotal"),
      statVisited: document.getElementById("statVisited"),
      statTotal: document.getElementById("statTotal"),
      statPct: document.getElementById("statPct"),
      progressBar: document.getElementById("progressBar"),
      searchInput: document.getElementById("searchInput"),
      chips: Array.from(document.querySelectorAll(".kp-chip")),
      parkList: document.getElementById("parkList"),
      swatchesFoot: document.getElementById("swatchesFoot"),
      swatchesMain: document.getElementById("swatchesMain"),
      detailCard: document.getElementById("detailCard"),
      authModal: document.getElementById("authModal"),
      authUser: document.getElementById("authUser"),
      authPass: document.getElementById("authPass"),
      authError: document.getElementById("authError"),
      authSubmit: document.getElementById("authSubmit"),
      pwModal: document.getElementById("pwModal"),
      pwCurrent: document.getElementById("pwCurrent"),
      pwNew: document.getElementById("pwNew"),
      pwError: document.getElementById("pwError"),
      pwSuccess: document.getElementById("pwSuccess"),
      pwClose: document.getElementById("pwClose"),
      pwSubmit: document.getElementById("pwSubmit")
    };
  }

  bindEvents() {
    this.el.drawerToggle.addEventListener("click", () => this.setDrawer(!this.state.drawerOpen));
    this.el.backdrop.addEventListener("click", () => this.setDrawer(false));

    this.el.searchInput.addEventListener("input", (e) => {
      this.state.query = e.target.value;
      this.renderList();
    });
    this.el.chips.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.state.filter = btn.dataset.filter;
        this.renderChips();
        this.renderList();
      });
    });

    this.el.authModal.addEventListener("click", () => this.closeAuth());
    this.el.authModal.querySelector(".kp-modal").addEventListener("click", (e) => e.stopPropagation());
    this.el.authSubmit.addEventListener("click", () => this.submitAuth());
    [this.el.authUser, this.el.authPass].forEach((inp) => {
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") this.submitAuth(); });
    });

    this.el.pwModal.addEventListener("click", () => this.closePw());
    this.el.pwModal.querySelector(".kp-modal").addEventListener("click", (e) => e.stopPropagation());
    this.el.pwClose.addEventListener("click", () => this.closePw());
    this.el.pwSubmit.addEventListener("click", () => this.submitPw());
    [this.el.pwCurrent, this.el.pwNew].forEach((inp) => {
      inp.addEventListener("keydown", (e) => { if (e.key === "Enter") this.submitPw(); });
    });

    this.renderChips();
  }

  setDrawer(open) {
    this.state.drawerOpen = open;
    this.el.aside.classList.toggle("kp-open", open);
    this.el.backdrop.classList.toggle("kp-open", open);
  }

  getPassword() { return localStorage.getItem("kp_password") || DEFAULT_PW; }

  async loadData() {
    let data = [];
    try { data = await (await fetch("./parks.json")).json(); }
    catch (e) { console.warn("parks.json ei latautunut", e); }

    const stored = readJSON("kp_visited", {});
    const visited = {};
    data.forEach((p) => { visited[p.id] = (p.id in stored) ? !!stored[p.id] : !!p.visited; });

    const cache = readJSON("kp_images", {});
    const images = {};
    data.forEach((p) => { if (cache[p.id]) images[p.id] = cache[p.id]; });

    this.state.parks = data;
    this.state.visited = visited;
    this.state.images = images;
    this.state.loaded = true;

    this.renderStats();
    this.renderList();
    this.initMap();
    this.startPrefetch();
  }

  startPrefetch() {
    this.queue = this.state.parks.map((p) => p.id).filter((id) => !this.state.images[id]);
    this.pumpQueue();
  }
  pumpQueue() {
    if (this.busy || !this.queue.length) return;
    const id = this.queue.shift();
    if (this.state.images[id]) { this.pumpQueue(); return; }
    this.busy = true;
    this.fetchImage(id, () => { this.busy = false; setTimeout(() => this.pumpQueue(), 900); });
  }

  cacheImage(id, url) {
    const cache = readJSON("kp_images", {});
    cache[id] = url;
    writeJSON("kp_images", cache);
  }

  fetchImage(id, done) {
    const cur = this.state.images[id];
    if (cur === "loading" || (cur && cur !== "none")) { if (done) done(); return; }
    const p = this.state.parks.find((x) => x.id === id);
    if (!p || !p.wiki) {
      this.state.images[id] = "none";
      this.refreshDetailIfSelected(id);
      if (done) done();
      return;
    }
    this.state.images[id] = "loading";
    this.refreshDetailIfSelected(id);
    this.tryImage(id, p.wiki, 0, done);
  }

  tryImage(id, wiki, attempt, done) {
    const url = "https://fi.wikipedia.org/api/rest_v1/page/media-list/" + encodeURIComponent(wiki.replace(/ /g, "_"));
    fetch(url)
      .then((r) => {
        if (r.status === 429) throw { retry: true };
        return r.ok ? r.json() : null;
      })
      .then((d) => {
        const items = ((d && d.items) || []).filter((i) => i.type === "image" && i.srcset && i.srcset[0]);
        const photo = items.find((i) => /\.jpe?g$/i.test(i.title || "")) || items[0];
        let img = photo ? photo.srcset[photo.srcset.length - 1].src : null;
        if (img && img.startsWith("//")) img = "https:" + img;
        this.state.images[id] = img || "none";
        this.refreshDetailIfSelected(id);
        if (img) this.cacheImage(id, img);
        if (done) done();
      })
      .catch((err) => {
        if (err && err.retry && attempt < 6) {
          setTimeout(() => this.tryImage(id, wiki, attempt + 1, done), 900 * (attempt + 1) + Math.random() * 500);
        } else {
          this.state.images[id] = "none";
          this.refreshDetailIfSelected(id);
          if (done) done();
        }
      });
  }

  refreshDetailIfSelected(id) {
    if (this.state.selectedId === id) this.renderDetail();
  }

  applyTheme(name) {
    const t = THEMES[name];
    if (!t || !this.el.root) return;
    Object.keys(t).forEach((k) => this.el.root.style.setProperty("--" + k, t[k]));
  }

  setTheme(name) {
    if (name === this.state.theme) return;
    this.state.theme = name;
    this.applyTheme(name);
    if (this.tileLayer) this.tileLayer.setUrl(TILES[name]);
    this.refreshAllMarkers();
    this.renderSwatches();
  }

  renderSwatches() {
    const html = ["raikas", "utua", "ruska"].map((name) => {
      const active = this.state.theme === name ? " active" : "";
      const label = name === "raikas" ? "Raikas" : name === "utua" ? "Utua" : "Ruska";
      return `<button class="kp-swatch${active}" data-theme="${name}" title="${label}" style="background:${THEME_SWATCH_COLOR[name]}"></button>`;
    }).join("");
    this.el.swatchesFoot.innerHTML = html;
    this.el.swatchesMain.innerHTML = html;
    [this.el.swatchesFoot, this.el.swatchesMain].forEach((container) => {
      container.querySelectorAll(".kp-swatch").forEach((btn) => {
        btn.addEventListener("click", () => this.setTheme(btn.dataset.theme));
      });
    });
  }

  renderChips() {
    this.el.chips.forEach((btn) => btn.classList.toggle("active", btn.dataset.filter === this.state.filter));
  }

  initMap() {
    if (!window.L) { setTimeout(() => this.initMap(), 120); return; }
    if (this.map) return;
    const L = window.L;
    this.map = L.map("map", { zoomControl: true, attributionControl: true, minZoom: 4, maxZoom: 13 })
      .fitBounds([[59.6, 20.2], [70.1, 31.6]]);
    this.tileLayer = L.tileLayer(TILES[this.state.theme], {
      subdomains: "abcd", maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(this.map);
    this.markers = {};
    this.state.parks.forEach((p) => {
      const m = L.circleMarker([p.lat, p.lng], this.markerStyle(p.id));
      m.on("click", () => this.selectPark(p.id));
      m.bindTooltip(p.nimi, { direction: "top", offset: [0, -6] });
      m.addTo(this.map);
      this.markers[p.id] = m;
    });
  }

  markerStyle(id) {
    const t = THEMES[this.state.theme];
    const vis = this.state.visited[id];
    const sel = this.state.selectedId === id;
    return {
      radius: sel ? 10 : 7,
      color: sel ? "#ffffff" : (vis ? t.visited : "#9aa39a"),
      weight: sel ? 3 : 1.5,
      fillColor: vis ? t.visited : t.unvisited,
      fillOpacity: 1
    };
  }
  refreshMarker(id) {
    const m = this.markers[id];
    if (!m) return;
    m.setStyle(this.markerStyle(id));
    if (this.state.selectedId === id) m.bringToFront();
  }
  refreshAllMarkers() { Object.keys(this.markers).forEach((id) => this.refreshMarker(id)); }

  selectPark(id) {
    const prev = this.state.selectedId;
    this.state.selectedId = id;
    this.setDrawer(false);
    this.refreshMarker(prev);
    this.refreshMarker(id);
    this.renderDetail();
    this.renderList();
    this.fetchImage(id);
    const p = this.state.parks.find((x) => x.id === id);
    if (p && this.map) this.map.flyTo([p.lat, p.lng], Math.max(this.map.getZoom(), 7), { duration: 0.6 });
  }
  clearSelection() {
    const prev = this.state.selectedId;
    this.state.selectedId = null;
    this.refreshMarker(prev);
    this.renderDetail();
    this.renderList();
  }

  toggleVisited(id) {
    if (!this.state.user) { this.openAuth(); return; }
    this.state.visited[id] = !this.state.visited[id];
    writeJSON("kp_visited", this.state.visited);
    this.refreshMarker(id);
    this.renderStats();
    this.renderList();
    this.renderDetail();
  }

  renderStats() {
    const total = this.state.parks.length || 41;
    const visitedCount = this.state.parks.filter((p) => this.state.visited[p.id]).length;
    const pct = total ? Math.round((visitedCount / total) * 100) : 0;
    this.el.topbarVisited.textContent = visitedCount;
    this.el.topbarTotal.textContent = total;
    this.el.statVisited.textContent = visitedCount;
    this.el.statTotal.textContent = total;
    this.el.statPct.textContent = pct + "%";
    this.el.progressBar.style.width = pct + "%";
  }

  renderList() {
    const { parks, visited, filter, query, selectedId } = this.state;
    const q = query.trim().toLowerCase();
    const display = parks.filter((p) => {
      if (filter === "visited" && !visited[p.id]) return false;
      if (filter === "unvisited" && visited[p.id]) return false;
      if (q && !(p.nimi.toLowerCase().includes(q) || (p.maakunta || "").toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => a.nimi.localeCompare(b.nimi, "fi"));

    if (!display.length) {
      this.el.parkList.innerHTML = '<div class="kp-empty">Ei tuloksia.</div>';
      return;
    }

    this.el.parkList.innerHTML = display.map((p) => {
      const vis = visited[p.id];
      const sel = selectedId === p.id;
      return `
        <button class="kp-row${sel ? " selected" : ""}" data-id="${p.id}">
          <span class="kp-row-dot" style="background:${vis ? "var(--visited)" : "var(--unvisited)"};box-shadow:0 0 0 3px ${vis ? "var(--accentSoft)" : "transparent"}"></span>
          <span class="kp-row-info">
            <span class="kp-row-name">${escapeHtml(p.nimi)}</span>
            <span class="kp-row-region">${escapeHtml(p.maakunta || "")}</span>
          </span>
          ${vis ? '<span class="kp-row-tag">&#10003;</span>' : '<span class="kp-row-tag" style="background:transparent"></span>'}
        </button>`;
    }).join("");

    this.el.parkList.querySelectorAll(".kp-row").forEach((btn) => {
      btn.addEventListener("click", () => this.selectPark(btn.dataset.id));
    });
  }

  renderDetail() {
    const sp = this.state.parks.find((x) => x.id === this.state.selectedId) || null;
    if (!sp) { this.el.detailCard.hidden = true; this.el.detailCard.innerHTML = ""; return; }

    const vis = this.state.visited[sp.id];
    const img = this.state.images[sp.id];
    const hasImg = img && img !== "none" && img !== "loading";
    const authed = !!this.state.user;
    const meta = [sp.maakunta, sp.perustettu ? "est. " + sp.perustettu : null, sp.pintaAla].filter(Boolean).join("  &middot;  ");
    const toggleLabel = !authed ? "Kirjaudu merkitäksesi" : (vis ? "Merkitse käymättömäksi" : "Merkitse käydyksi ✓");

    this.el.detailCard.hidden = false;
    this.el.detailCard.innerHTML = `
      <div class="kp-detail-hero">
        ${hasImg ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(sp.nimi)}">` : `<span class="kp-detail-hero-label">${img === "loading" ? "haetaan kuvaa…" : "kuva ei saatavilla"}</span>`}
        <div class="kp-detail-hero-gradient"></div>
        <button class="kp-close" id="detailClose" aria-label="Sulje">&times;</button>
        <span class="kp-hero-tag ${vis ? "visited" : "unvisited"}">${vis ? "Käyty" : "Ei vielä käyty"}</span>
      </div>
      <div class="kp-detail-body">
        <div class="kp-detail-name">${escapeHtml(sp.nimi)}</div>
        <div class="kp-detail-meta">${meta}</div>
        <p class="kp-detail-desc">${escapeHtml(sp.kuvaus || "")}</p>
        <div class="kp-detail-actions">
          <button class="kp-toggle-btn${vis && authed ? " is-visited" : ""}" id="detailToggle">${toggleLabel}</button>
          <a class="kp-link" href="https://www.luontoon.fi/${encodeURIComponent(sp.id)}" target="_blank" rel="noopener">luontoon.fi &rarr;</a>
        </div>
      </div>`;

    document.getElementById("detailClose").addEventListener("click", () => this.clearSelection());
    document.getElementById("detailToggle").addEventListener("click", () => this.toggleVisited(sp.id));
  }

  renderAuthBox() {
    if (this.state.user) {
      this.el.authBox.innerHTML = `
        <div class="kp-auth-card">
          <div class="kp-auth-card-row">
            <span class="kp-avatar">${this.state.user.charAt(0).toUpperCase()}</span>
            <span style="flex:1;min-width:0">
              <span class="kp-auth-card-name">${escapeHtml(this.state.user)}</span>
              <span class="kp-auth-card-status">Kirjautunut</span>
            </span>
          </div>
          <div class="kp-auth-card-actions">
            <button class="kp-pw-btn" id="openPwBtn">Vaihda salasana</button>
            <button class="kp-logout-btn" id="logoutBtn">Kirjaudu ulos</button>
          </div>
        </div>`;
      document.getElementById("openPwBtn").addEventListener("click", () => this.openPw());
      document.getElementById("logoutBtn").addEventListener("click", () => this.logout());
    } else {
      this.el.authBox.innerHTML = `
        <button class="kp-login-btn" id="openAuthBtn">
          <span class="kp-login-icon"><span></span><span></span></span>
          Kirjaudu merkitäksesi puistoja
        </button>`;
      document.getElementById("openAuthBtn").addEventListener("click", () => this.openAuth());
    }
  }

  openAuth() {
    this.state.authOpen = true;
    this.state.authError = "";
    this.el.authUser.value = "";
    this.el.authPass.value = "";
    this.el.authError.hidden = true;
    this.el.authModal.hidden = false;
    this.el.authUser.focus();
  }
  closeAuth() {
    this.state.authOpen = false;
    this.el.authModal.hidden = true;
  }
  submitAuth() {
    const u = this.el.authUser.value.trim();
    const p = this.el.authPass.value;
    const showError = (msg) => { this.el.authError.textContent = msg; this.el.authError.hidden = false; };
    if (!u || !p) { showError("Anna käyttäjätunnus ja salasana."); return; }
    if (u.toLowerCase() !== USERNAME) { showError("Tuntematon käyttäjätunnus."); return; }
    if (p !== this.getPassword()) { showError("Väärä salasana."); return; }
    localStorage.setItem("kp_session", "1");
    this.state.user = USERNAME;
    this.closeAuth();
    this.renderAuthBox();
    this.renderDetail();
  }

  logout() {
    localStorage.removeItem("kp_session");
    this.state.user = null;
    this.renderAuthBox();
    this.renderDetail();
  }

  openPw() {
    this.state.pwOpen = true;
    this.el.pwCurrent.value = "";
    this.el.pwNew.value = "";
    this.el.pwError.hidden = true;
    this.el.pwSuccess.hidden = true;
    this.el.pwModal.hidden = false;
    this.el.pwCurrent.focus();
  }
  closePw() {
    this.state.pwOpen = false;
    this.el.pwModal.hidden = true;
  }
  submitPw() {
    const cur = this.el.pwCurrent.value;
    const nw = this.el.pwNew.value;
    const showError = (msg) => { this.el.pwError.textContent = msg; this.el.pwError.hidden = false; this.el.pwSuccess.hidden = true; };
    if (cur !== this.getPassword()) { showError("Nykyinen salasana on väärä."); return; }
    if (!nw || nw.length < 4) { showError("Uuden salasanan pituus vähintään 4 merkkiä."); return; }
    if (nw === cur) { showError("Uusi salasana ei voi olla sama kuin vanha."); return; }
    localStorage.setItem("kp_password", nw);
    this.el.pwError.hidden = true;
    this.el.pwSuccess.textContent = "Salasana vaihdettu.";
    this.el.pwSuccess.hidden = false;
    this.el.pwCurrent.value = "";
    this.el.pwNew.value = "";
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(str) { return escapeHtml(str); }

document.addEventListener("DOMContentLoaded", () => { window.kpApp = new KansallispuistotApp(); });
