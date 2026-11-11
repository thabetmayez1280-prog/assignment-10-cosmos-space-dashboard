/* Cosmos Space Dashboard — API integration */
(() => {
  "use strict";

  const NASA_API_KEY = "DEMO_KEY";
  const NASA_URL = "https://api.nasa.gov/planetary/apod";
  const LAUNCHES_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=12&mode=detailed";
  const PLANETS_URL = "https://api.le-systeme-solaire.net/rest/bodies/?filter[]=isPlanet,eq,true";
  const $ = (id) => document.getElementById(id);
  const state = { planets: [], activePlanet: null };

  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[c]);

  function setText(id, value, fallback = "—") {
    const el = $(id);
    if (el) el.textContent = value === null || value === undefined || value === "" ? fallback : value;
  }
  function formatDate(date) {
    return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date);
  }
  function showMessage(container, message, retry) {
    if (!container) return;
    container.innerHTML = `<div class="col-span-full text-center py-10 text-slate-300">
      <p class="mb-3">${escapeHTML(message)}</p>
      ${retry ? '<button class="px-4 py-2 bg-blue-500 rounded-lg hover:bg-blue-600" data-retry>Try again</button>' : ""}
    </div>`;
    if (retry) container.querySelector("[data-retry]")?.addEventListener("click", retry);
  }

  // Section navigation
  const sections = [...document.querySelectorAll(".app-section")];
  const navLinks = [...document.querySelectorAll(".nav-link")];
  function activateSection(name) {
    sections.forEach(section => section.classList.toggle("hidden", section.dataset.section !== name));
    navLinks.forEach(link => {
      const active = link.dataset.section === name;
      link.classList.toggle("bg-blue-500/10", active);
      link.classList.toggle("text-blue-400", active);
      link.classList.toggle("text-slate-300", !active);
    });
    $("sidebar")?.classList.remove("mobile-open");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  navLinks.forEach(link => link.addEventListener("click", event => {
    event.preventDefault();
    activateSection(link.dataset.section);
  }));
  $("sidebar-toggle")?.addEventListener("click", () => $("sidebar")?.classList.toggle("mobile-open"));

  // NASA Astronomy Picture of the Day
  async function loadApod(date) {
    const loading = $("apod-loading"), image = $("apod-image");
    if (loading) loading.classList.remove("hidden");
    if (image) image.classList.add("opacity-40");
    try {
      const url = new URL(NASA_URL);
      url.search = new URLSearchParams({ api_key: NASA_API_KEY, date });
      const response = await fetch(url);
      if (!response.ok) throw new Error(`NASA API returned ${response.status}`);
      const data = await response.json();

      setText("apod-title", data.title);
      setText("apod-date-detail", data.date);
      setText("apod-explanation", data.explanation);
      setText("apod-copyright", data.copyright ? `© ${data.copyright}` : "© NASA");
      setText("apod-date-info", data.date);
      setText("apod-media-type", data.media_type === "video" ? "Video" : "Image");
      setText("apod-date", `Astronomy Picture of the Day — ${formatDate(new Date(`${data.date}T00:00:00Z`))}`);

      const container = $("apod-image-container");
      if (data.media_type === "image" && data.url) {
        if (image) {
          image.src = data.hdurl || data.url;
          image.alt = data.title || "NASA Astronomy Picture of the Day";
          image.classList.remove("hidden", "opacity-40");
        }
        const video = container?.querySelector("iframe[data-apod-video]");
        video?.remove();
      } else if (data.media_type === "video" && container) {
        image?.classList.add("hidden");
        let frame = container.querySelector("iframe[data-apod-video]");
        if (!frame) {
          frame = document.createElement("iframe");
          frame.dataset.apodVideo = "true";
          frame.className = "w-full h-full min-h-[300px]";
          frame.allowFullscreen = true;
          frame.title = "NASA APOD video";
          container.appendChild(frame);
        }
        frame.src = data.url;
      }
      const full = $("apod-image-container")?.querySelector("[data-full-resolution]");
      if (full) full.onclick = () => window.open(data.hdurl || data.url, "_blank", "noopener");
    } catch (error) {
      console.error("APOD:", error);
      setText("apod-title", "Unable to load today's space picture");
      setText("apod-explanation", "NASA's service could not be reached. Please check your connection and try again.");
    } finally {
      loading?.classList.add("hidden");
      image?.classList.remove("opacity-40");
    }
  }

  const dateInput = $("apod-date-input");
  const today = new Date();
  const todayISO = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())).toISOString().slice(0, 10);
  if (dateInput) {
    dateInput.max = todayISO;
    dateInput.value = todayISO;
  }
  $("load-date-btn")?.addEventListener("click", () => {
    if (dateInput?.value) loadApod(dateInput.value);
  });
  $("today-apod-btn")?.addEventListener("click", () => {
    if (dateInput) dateInput.value = todayISO;
    loadApod(todayISO);
  });
  $("apod-image-container")?.querySelector("[data-full-resolution]")?.addEventListener("click", () => {
    const image = $("apod-image");
    if (image?.src) window.open(image.src, "_blank", "noopener");
  });

  // Launch Library 2 (The Space Devs)
  function launchDate(value) {
    if (!value) return "Date TBA";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "Date TBA" : d.toLocaleString(undefined, {
      dateStyle: "medium", timeStyle: "short"
    });
  }
  function launchImage(launch) {
    return launch.image || launch.rocket?.configuration?.image?.image_url ||
      launch.pad?.location?.name ? (launch.image || launch.rocket?.configuration?.image?.image_url || "") : "";
  }
  async function loadLaunches() {
    const grid = $("launches-grid"), featured = $("featured-launch");
    if (grid) grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-8">Loading upcoming launches…</p>';
    try {
      const response = await fetch(LAUNCHES_URL);
      if (!response.ok) throw new Error(`Launch API returned ${response.status}`);
      const payload = await response.json();
      const launches = (payload.results || []).filter(item => item).sort((a,b) =>
        new Date(a.net || a.window_start || 0) - new Date(b.net || b.window_start || 0));
      setText("launches-count", launches.length);
      setText("launches-count-mobile", launches.length);
      if (!launches.length) {
        showMessage(grid, "No upcoming launches are listed right now. Please check again soon.", loadLaunches);
        if (featured) featured.innerHTML = "";
        return;
      }
      const first = launches[0];
      if (featured) {
        const mission = first.mission?.name || first.name || "Upcoming mission";
        const agency = first.launch_service_provider?.name || "Launch provider TBA";
        const rocket = first.rocket?.configuration?.full_name || first.rocket?.configuration?.name || "Rocket TBA";
        const pad = first.pad?.name || first.pad?.location?.name || "Launch site TBA";
        const img = first.image || first.rocket?.configuration?.image?.image_url;
        featured.innerHTML = `<div class="relative bg-slate-800/50 border border-slate-700 rounded-3xl overflow-hidden p-5 md:p-8">
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
            <div><span class="inline-flex px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-sm mb-4">★ Featured launch</span>
              <h3 class="text-2xl md:text-3xl font-bold mb-3">${escapeHTML(mission)}</h3>
              <p class="text-slate-400 mb-2">${escapeHTML(agency)} · ${escapeHTML(rocket)}</p>
              <p class="text-slate-300 mb-2"><i class="fas fa-calendar mr-2"></i>${escapeHTML(launchDate(first.net || first.window_start))}</p>
              <p class="text-slate-400 text-sm"><i class="fas fa-map-marker-alt mr-2"></i>${escapeHTML(pad)}</p>
              ${first.url ? `<a class="inline-block mt-5 text-blue-400 hover:text-blue-300" href="${escapeHTML(first.url)}" target="_blank" rel="noopener">Mission details ↗</a>` : ""}
            </div>
            <div class="rounded-2xl overflow-hidden bg-slate-900/70 min-h-[180px] flex items-center justify-center">
              ${img ? `<img src="${escapeHTML(img)}" alt="${escapeHTML(mission)}" class="w-full h-64 object-cover" loading="lazy">` : '<div class="text-7xl py-12">🚀</div>'}
            </div>
          </div></div>`;
      }
      if (grid) {
        grid.innerHTML = launches.map((launch, index) => {
          const name = launch.name || launch.mission?.name || "Unnamed mission";
          const provider = launch.launch_service_provider?.name || "Provider TBA";
          const date = launchDate(launch.net || launch.window_start);
          const location = launch.pad?.location?.name || launch.pad?.name || "Launch location TBA";
          const status = launch.status?.name || "Status TBA";
          const img = launch.image || launch.rocket?.configuration?.image?.image_url;
          return `<article class="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden hover:border-blue-500/60 transition-colors">
            ${img ? `<img src="${escapeHTML(img)}" alt="${escapeHTML(name)}" class="w-full h-40 object-cover" loading="lazy">` : '<div class="h-40 bg-slate-900 flex items-center justify-center text-5xl">🚀</div>'}
            <div class="p-4"><div class="flex justify-between gap-2 items-start mb-2"><h3 class="font-semibold">${escapeHTML(name)}</h3><span class="text-xs text-blue-300 bg-blue-500/10 rounded-full px-2 py-1">${escapeHTML(status)}</span></div>
              <p class="text-sm text-slate-400 mb-2">${escapeHTML(provider)}</p>
              <p class="text-sm text-slate-300 mb-2"><i class="far fa-calendar mr-2"></i>${escapeHTML(date)}</p>
              <p class="text-xs text-slate-500 mb-4"><i class="fas fa-map-marker-alt mr-2"></i>${escapeHTML(location)}</p>
              ${launch.url ? `<a href="${escapeHTML(launch.url)}" target="_blank" rel="noopener" class="text-sm text-blue-400 hover:text-blue-300">View launch details ↗</a>` : ""}
            </div></article>`;
        }).join("");
      }
    } catch (error) {
      console.error("Launches:", error);
      showMessage(grid, "Could not load launch data. The launch service may be temporarily unavailable.", loadLaunches);
      if (featured) featured.innerHTML = "";
      setText("launches-count", "—");
      setText("launches-count-mobile", "—");
    }
  }

  // Solar System OpenData
  const planetImages = {
    mercury: "images/mercury.png", venus: "images/venus.png", earth: "images/earth.png",
    mars: "images/mars.png", jupiter: "images/jupiter.png", saturn: "images/saturn.png",
    uranus: "images/uranus.png", neptune: "images/neptune.png"
  };
  const planetFacts = {
    mercury: "The smallest planet and the closest to the Sun.",
    venus: "A rocky world with a dense atmosphere and extreme surface heat.",
    earth: "Our home planet, the only world known to support life.",
    mars: "The red planet, with ancient valleys and the tallest volcano in the Solar System.",
    jupiter: "The largest planet, famous for its Great Red Spot.",
    saturn: "A gas giant surrounded by a spectacular system of rings.",
    uranus: "An ice giant that rotates on its side.",
    neptune: "A distant ice giant with powerful winds."
  };
  function number(value, digits = 2) {
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : String(value);
  }
  function displayPlanet(planet) {
    if (!planet) return;
    state.activePlanet = planet;
    const name = planet.englishName || planet.name;
    const key = String(name).toLowerCase();
    const image = $("planet-detail-image");
    if (image) { image.src = planetImages[key] || "images/placeholder.webp"; image.alt = name; }
    setText("planet-detail-name", name);
    setText("planet-detail-description", planetFacts[key] || `${name} is a body in our Solar System.`);
    setText("planet-distance", `${number(planet.semimajorAxis / 149597870.7, 2)} AU`);
    setText("planet-radius", `${number(planet.meanRadius)} km`);
    setText("planet-mass", planet.mass ? `${number(planet.mass.massValue * Math.pow(10, planet.mass.massExponent), 3)} kg` : "—");
    setText("planet-density", `${number(planet.density)} g/cm³`);
    setText("planet-orbital-period", `${number(planet.sideralOrbit)} days`);
    setText("planet-rotation", `${number(planet.sideralRotation)} hours`);
    setText("planet-moons", planet.moons?.length ?? 0);
    setText("planet-gravity", `${number(planet.gravity)} m/s²`);
    setText("planet-discoverer", planet.discoveredBy || "Known since antiquity");
    setText("planet-discovery-date", planet.discoveryDate || "Ancient");
    setText("planet-body-type", planet.bodyType || (planet.isPlanet ? "Planet" : "—"));
    setText("planet-volume", planet.vol ? `${number(planet.vol.volValue * Math.pow(10, planet.vol.volExponent), 3)} km³` : "—");
    setText("planet-perihelion", `${number(planet.perihelion / 149597870.7, 3)} AU`);
    setText("planet-aphelion", `${number(planet.aphelion / 149597870.7, 3)} AU`);
    setText("planet-eccentricity", number(planet.eccentricity, 4));
    setText("planet-inclination", `${number(planet.inclination, 2)}°`);
    setText("planet-axial-tilt", `${number(planet.axialTilt, 2)}°`);
    setText("planet-temp", planet.avgTemp ? `${number(planet.avgTemp - 273.15, 1)} °C` : "—");
    setText("planet-escape", planet.escape ? `${number(planet.escape)} m/s` : "—");
    document.querySelectorAll(".planet-card").forEach(card => {
      const active = card.dataset.planetId === key;
      card.classList.toggle("border-blue-400", active);
      card.classList.toggle("bg-blue-500/10", active);
    });
  }
  function renderPlanetCards(planets) {
    const grid = $("planets-grid");
    if (!grid) return;
    const order = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
    planets.sort((a,b) => order.indexOf(a.englishName) - order.indexOf(b.englishName));
    grid.innerHTML = planets.map(p => {
      const key = (p.englishName || p.name).toLowerCase();
      return `<button type="button" class="planet-card text-left bg-slate-800/50 border border-slate-700 rounded-2xl p-4 transition-all cursor-pointer group hover:border-blue-400" data-planet-id="${escapeHTML(key)}">
        <div class="relative mb-3 h-24 flex items-center justify-center"><img class="w-20 h-20 object-contain group-hover:scale-110 transition-transform" src="${planetImages[key] || "images/placeholder.webp"}" alt="${escapeHTML(p.englishName || p.name)}" loading="lazy"></div>
        <h4 class="font-semibold text-center text-sm">${escapeHTML(p.englishName || p.name)}</h4>
        <p class="text-xs text-slate-400 text-center">${number(p.semimajorAxis / 149597870.7, 2)} AU</p>
      </button>`;
    }).join("");
    grid.querySelectorAll(".planet-card").forEach(card => card.addEventListener("click", () => {
      const chosen = state.planets.find(p => (p.englishName || p.name).toLowerCase() === card.dataset.planetId);
      displayPlanet(chosen);
    }));
    const first = state.planets.find(p => (p.englishName || p.name) === "Earth") || state.planets[0];
    if (first) displayPlanet(first);
  }
  async function loadPlanets() {
    const grid = $("planets-grid");
    if (grid) grid.innerHTML = '<p class="col-span-full text-center text-slate-400 py-8">Loading planets…</p>';
    try {
      const response = await fetch(PLANETS_URL);
      if (!response.ok) throw new Error(`Solar System API returned ${response.status}`);
      const data = await response.json();
      state.planets = (data.bodies || []).filter(p => p.isPlanet);
      if (!state.planets.length) throw new Error("No planet data received");
      renderPlanetCards(state.planets);
      renderComparison(state.planets);
    } catch (error) {
      console.error("Planets:", error);
      showMessage(grid, "Could not load planet data. Please check your connection and retry.", loadPlanets);
    }
  }
  function renderComparison(planets) {
    const tbody = $("planet-comparison-tbody");
    if (!tbody) return;
    tbody.innerHTML = planets.map(p => `<tr class="hover:bg-slate-800/30">
      <td class="px-4 py-3 font-semibold">${escapeHTML(p.englishName || p.name)}</td>
      <td class="px-4 py-3 text-slate-300">${number(p.semimajorAxis / 149597870.7, 2)} AU</td>
      <td class="px-4 py-3 text-slate-300">${number(p.meanRadius * 2, 0)} km</td>
      <td class="px-4 py-3 text-slate-300">${number(p.mass ? p.mass.massValue * Math.pow(10, p.mass.massExponent - 24) : null, 2)}</td>
      <td class="px-4 py-3 text-slate-300">${number(p.sideralOrbit, 1)} days</td>
      <td class="px-4 py-3 text-slate-300">${p.moons?.length ?? 0}</td>
      <td class="px-4 py-3 text-slate-300">${escapeHTML(p.bodyType || "Planet")}</td>
    </tr>`).join("");
  }

  // Fix paths in the supplied starter markup: archive contains images/, not assets/images/.
  document.querySelectorAll('img[src*="assets/images/"]').forEach(img => {
    img.src = img.getAttribute("src").replace("assets/images/", "images/");
  });

  loadApod(todayISO);
  loadLaunches();
  loadPlanets();
})();
