(function () {
  "use strict";

  const discovery = window.UAT_DISCOVERY;
  const cases = window.UAT_CASES;
  const storageKey = `mmg-stellar-uat:${discovery.version}`;
  const statuses = ["Pass", "Fail", "Blocked", "Not Run"];
  const personaMap = new Map(discovery.personas.map((persona) => [persona.id, persona]));
  personaMap.set("cross-role", { label: "Cross-Role", permissions: ["Multiple coordinated permissions"] });
  personaMap.set("general", { label: "All personas", permissions: ["Context-dependent"] });

  function blankState() {
    return { version: discovery.version, run: {}, accounts: {}, results: {}, updatedAt: null };
  }

  function loadState() {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!stored || stored.version !== discovery.version) return blankState();
      return { ...blankState(), ...stored, run: stored.run || {}, accounts: stored.accounts || {}, results: stored.results || {} };
    } catch {
      return blankState();
    }
  }

  let state = loadState();
  let toastTimer;

  function saveState() {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(state));
    updateDashboard();
    updateAllStatusBadges();
    updateTraceabilityStatuses();
  }

  function resultFor(caseId) {
    return state.results[caseId] || {
      status: "Not Run",
      actualResult: "",
      defect: "",
      tester: "",
      date: "",
      evidence: []
    };
  }

  function setResult(caseId, patch) {
    state.results[caseId] = { ...resultFor(caseId), ...patch };
    saveState();
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function slug(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function showToast(message) {
    const toast = document.querySelector("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  function list(items) {
    return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  function renderCase(testCase) {
    const result = resultFor(testCase.id);
    const statusClass = slug(result.status);
    const persona = personaMap.get(testCase.persona) || { label: testCase.persona };
    const screenshotMarkup = testCase.screenshots.length
      ? `<div><h3>Related screenshots</h3><div class="screenshots">${testCase.screenshots.flatMap((name) => ["desktop", "mobile"].map((viewport) => {
        const path = `assets/screenshots/captured/${name}-${viewport}.png`;
        return `<figure class="screenshot-frame"><a href="${escapeHtml(path)}" target="_blank"><img alt="${escapeHtml(name)} ${viewport} UAT evidence" data-screenshot src="${escapeHtml(path)}"><span class="screenshot-placeholder"><strong>Screenshot pending</strong>${escapeHtml(name)}-${viewport}.png<br>See screenshot manifest.</span></a><figcaption>${escapeHtml(name)} · ${viewport}</figcaption></figure>`;
      })).join("")}</div></div>`
      : "";

    return `
      <details class="test-case" data-case-id="${escapeHtml(testCase.id)}" data-persona="${escapeHtml(testCase.persona)}" data-category="${escapeHtml(testCase.category)}">
        <summary class="test-summary">
          <span class="case-id">${escapeHtml(testCase.id)}</span>
          <span class="case-title"><strong>${escapeHtml(testCase.purpose)}</strong><span>${escapeHtml(persona.label)} · ${escapeHtml(testCase.category)} · ${escapeHtml(testCase.scenario)} · ${escapeHtml(testCase.priority)}</span></span>
          <span class="status-badge ${statusClass}" data-status-badge="${escapeHtml(testCase.id)}">${escapeHtml(result.status)}</span>
        </summary>
        <div class="case-body">
          <div class="case-metadata">
            <span class="chip">${escapeHtml(testCase.feature)}</span>
            <span class="chip">${escapeHtml(testCase.priority)} risk</span>
            <span class="chip">${escapeHtml(testCase.confidence)}</span>
          </div>
          <div class="case-purpose"><h3>Purpose</h3><p>${escapeHtml(testCase.purpose)}</p></div>
          <div class="case-columns">
            <div class="mini-panel"><h4>Preconditions</h4>${list(testCase.preconditions.length ? testCase.preconditions : ["None beyond the required account"] )}</div>
            <div class="mini-panel"><h4>Required account / permission</h4><p>${escapeHtml(testCase.account)}</p></div>
            <div class="mini-panel"><h4>Required test data</h4>${list(testCase.data.length ? testCase.data : ["Use synthetic UAT-prefixed data relevant to the scenario"])}</div>
          </div>
          <div><h3>Numbered steps and expected results</h3><div class="steps">${testCase.steps.map((step) => `<div class="step"><div><strong>${escapeHtml(step.action)}</strong><span><b>Expected:</b> ${escapeHtml(step.expected)}</span></div></div>`).join("")}</div></div>
          <div class="final-result"><strong>Final expected result:</strong> ${escapeHtml(testCase.finalExpected)}</div>
          ${screenshotMarkup}
          <div class="case-columns">
            <div class="mini-panel"><h4>Cleanup / reset</h4><p>${escapeHtml(testCase.cleanup)}</p></div>
            <div class="mini-panel"><h4>Evidence checklist</h4><div class="evidence-checks">${testCase.evidence.map((item, index) => `<label><input type="checkbox" data-evidence-index="${index}" ${result.evidence[index] ? "checked" : ""}><span>${escapeHtml(item)}</span></label>`).join("")}</div></div>
            <div class="mini-panel"><h4>Repository evidence</h4><p class="source-evidence">${testCase.sourceEvidence.map(escapeHtml).join("<br>") || "Requires manual validation"}</p></div>
          </div>
          <div class="result-panel">
            <div><strong>Test status</strong><div class="status-controls">${statuses.map((status) => `<button type="button" class="status-control ${result.status === status ? "selected" : ""}" data-set-status="${escapeHtml(status)}">${escapeHtml(status)}</button>`).join("")}</div></div>
            <div class="result-fields">
              <label class="wide">Actual-result notes<textarea data-result-field="actualResult" placeholder="What happened? Include the booking/reference ID when safe.">${escapeHtml(result.actualResult)}</textarea></label>
              <label>Defect / reference number<input data-result-field="defect" value="${escapeHtml(result.defect)}" placeholder="UAT-123"></label>
              <label>Tester name<input data-result-field="tester" value="${escapeHtml(result.tester)}" placeholder="Name"></label>
              <label>Test date<input data-result-field="date" value="${escapeHtml(result.date)}" type="date"></label>
            </div>
          </div>
        </div>
      </details>`;
  }

  function casesForList(key) {
    if (["customer", "super-admin", "receptionist", "booking-admin", "social-media", "cross-role"].includes(key)) {
      return cases.filter((testCase) => testCase.persona === key);
    }
    if (key === "permissions") return cases.filter((testCase) => testCase.category === "Access control");
    if (key === "responsive") return cases.filter((testCase) => testCase.category === "Responsive" || testCase.category === "Reliability" && testCase.id.startsWith("GEN-"));
    if (key === "accessibility") return cases.filter((testCase) => ["Accessibility", "Usability"].includes(testCase.category));
    return [];
  }

  function renderCases() {
    document.querySelectorAll("[data-case-list]").forEach((container) => {
      const selected = casesForList(container.dataset.caseList);
      container.innerHTML = selected.length ? selected.map(renderCase).join("") : `<p class="callout">No documented cases in this section.</p>`;
    });
    bindCaseControls();
  }

  function bindCaseControls() {
    document.querySelectorAll("[data-screenshot]").forEach((image) => {
      image.addEventListener("load", () => {
        image.hidden = false;
        image.nextElementSibling.hidden = true;
      });
      image.addEventListener("error", () => { image.hidden = true; });
    });
    document.querySelectorAll(".test-case").forEach((element) => {
      const caseId = element.dataset.caseId;
      element.querySelectorAll("[data-set-status]").forEach((button) => {
        button.addEventListener("click", () => {
          setResult(caseId, { status: button.dataset.setStatus });
          document.querySelectorAll(`.test-case[data-case-id="${CSS.escape(caseId)}"] [data-set-status]`).forEach((candidate) => {
            candidate.classList.toggle("selected", candidate.dataset.setStatus === button.dataset.setStatus);
          });
        });
      });
      element.querySelectorAll("[data-result-field]").forEach((field) => {
        field.addEventListener("change", () => setResult(caseId, { [field.dataset.resultField]: field.value }));
      });
      element.querySelectorAll("[data-evidence-index]").forEach((checkbox) => {
        checkbox.addEventListener("change", () => {
          const evidence = [...resultFor(caseId).evidence];
          evidence[Number(checkbox.dataset.evidenceIndex)] = checkbox.checked;
          setResult(caseId, { evidence });
        });
      });
    });
  }

  function updateAllStatusBadges() {
    document.querySelectorAll("[data-status-badge]").forEach((badge) => {
      const result = resultFor(badge.dataset.statusBadge);
      badge.textContent = result.status;
      badge.className = `status-badge ${slug(result.status)}`;
    });
  }

  function statsFor(selectedCases) {
    const stats = { total: selectedCases.length, Pass: 0, Fail: 0, Blocked: 0, "Not Run": 0 };
    selectedCases.forEach((testCase) => { stats[resultFor(testCase.id).status] += 1; });
    stats.executed = stats.total - stats["Not Run"];
    stats.percent = stats.total ? Math.round((stats.executed / stats.total) * 100) : 0;
    return stats;
  }

  function updateDashboard() {
    const overall = statsFor(cases);
    document.querySelector("#hero-progress").textContent = `${overall.percent}%`;
    const dashboard = document.querySelector("#dashboard-cards");
    dashboard.innerHTML = [
      ["Executed", overall.executed, `${overall.total} total cases`],
      ["Passed", overall.Pass, "Accepted behavior"],
      ["Failed", overall.Fail, "Defects to triage"],
      ["Blocked", overall.Blocked, "Needs data, access, or decision"]
    ].map(([label, value, hint]) => `<article class="dashboard-card"><span>${label}</span><strong>${value}</strong><span>${hint}</span></article>`).join("");

    const rows = [...discovery.personas, { id: "cross-role", label: "Cross-Role" }, { id: "general", label: "General" }].map((persona) => {
      const personaStats = statsFor(cases.filter((testCase) => testCase.persona === persona.id));
      return `<tr><td>${escapeHtml(persona.label)}</td><td>${personaStats.total}</td><td>${personaStats.Pass}</td><td>${personaStats.Fail}</td><td>${personaStats.Blocked}</td><td>${personaStats["Not Run"]}</td><td>${personaStats.percent}%</td></tr>`;
    }).join("");
    document.querySelector("#progress-table").innerHTML = rows;
  }

  function renderStaticContent() {
    document.querySelector("#assessment-meta").innerHTML = `<span class="meta-chip">Guide ${escapeHtml(discovery.version)}</span><span class="meta-chip">Assessed ${escapeHtml(discovery.assessedCommit)}</span><span class="meta-chip">${cases.length} unique cases</span><span class="meta-chip">${escapeHtml(discovery.timezone)}</span>`;
    document.querySelector("#footer-version").textContent = `Guide ${discovery.version} · assessed ${discovery.assessedCommit}`;
    document.querySelector("#persona-cards").innerHTML = discovery.personas.map((persona) => `<a class="persona-card" href="#${persona.id}-guide"><span class="persona-icon">${escapeHtml(persona.icon)}</span><h3>Start as ${escapeHtml(persona.label)}</h3><p>${escapeHtml(persona.description)}</p><span>${cases.filter((item) => item.persona === persona.id).length} test cases →</span></a>`).join("");
    document.querySelector("#safe-data-rules").innerHTML = discovery.safeDataRules.map((rule) => `<div class="check-item"><span>${escapeHtml(rule)}</span></div>`).join("");
    document.querySelector("#configuration-table").innerHTML = discovery.configuration.map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.value)}</td><td><code>${escapeHtml(item.evidence)}</code></td></tr>`).join("");
    document.querySelector("#account-table").innerHTML = discovery.personas.map((persona) => `<tr><td><strong>${escapeHtml(persona.label)}</strong></td><td><input data-account-field="${persona.id}" value="${escapeHtml(state.accounts[persona.id] || "")}" placeholder="UAT-${escapeHtml(persona.short)}-01"></td><td>${escapeHtml(persona.permissions.join(", "))}</td><td><input data-account-tester="${persona.id}" value="${escapeHtml(state.accounts[`${persona.id}:tester`] || "")}" placeholder="Tester name"></td></tr>`).join("");
    document.querySelectorAll("[data-account-field], [data-account-tester]").forEach((input) => input.addEventListener("change", () => {
      const key = input.dataset.accountField || `${input.dataset.accountTester}:tester`;
      state.accounts[key] = input.value;
      saveState();
    }));
    document.querySelector("#permission-matrix").innerHTML = `<div class="permission-grid">${discovery.personas.map((persona) => `<article class="permission-column"><h3>${escapeHtml(persona.label)}</h3>${list(persona.permissions)}</article>`).join("")}</div>`;
    document.querySelector("#known-findings").innerHTML = discovery.knownFindings.map((finding) => `<article class="finding ${escapeHtml(finding.level)}"><span class="chip">${escapeHtml(discovery.confidenceLegend[finding.level] ? finding.level : "finding")}</span><h3>${escapeHtml(finding.title)}</h3><p>${escapeHtml(finding.detail)}</p><small>Evidence: ${finding.evidence.map(escapeHtml).join(" · ")}</small></article>`).join("");
    document.querySelector("#technical-discovery").innerHTML = `<h3>Framework</h3>${list(discovery.framework)}<h3>State lifecycles</h3>${Object.entries(discovery.lifecycle).map(([name, values]) => `<div class="mini-panel"><h4>${escapeHtml(name)}</h4>${list(values)}</div>`).join("")}<h3>Confidence labels</h3>${list(Object.entries(discovery.confidenceLegend).map(([key, value]) => `${key}: ${value}`))}`;
    document.querySelector("#print-links").innerHTML = [
      ["Complete guide", "all"], ["Customer", "customer"], ["Super Admin", "super-admin"], ["Receptionist", "receptionist"], ["Booking Admin", "booking-admin"], ["Social Media", "social-media"]
    ].map(([label, key]) => `<a class="print-link" href="?print=${key}" target="_blank">${label} print view ↗</a>`).join("");
  }

  const issueTemplate = `UAT test-case ID:
Title:
Persona:
Environment:
URL/page:
Date and time (Asia/Manila):
Severity: Critical / High / Medium / Low
Preconditions:
Steps to reproduce:
1.
2.
3.
Expected result:
Actual result:
Frequency: Always / Sometimes / Once
Screenshot/video reference:
Browser/device:
UAT booking or record ID (no real customer data):
Additional notes:`;

  function bindGeneralControls() {
    document.querySelector("#issue-template").textContent = issueTemplate;
    document.querySelector("#copy-issue-template").addEventListener("click", async () => {
      await navigator.clipboard.writeText(issueTemplate);
      showToast("Issue template copied");
    });
    document.querySelectorAll("[data-run-field]").forEach((input) => {
      input.value = state.run[input.dataset.runField] || "";
      input.addEventListener("change", () => { state.run[input.dataset.runField] = input.value; saveState(); });
    });
    document.querySelector("#reset-progress").addEventListener("click", () => {
      if (!window.confirm("Reset every locally stored UAT result, note, tester, date, account alias, and run field for this guide version? Export first if you may need the data.")) return;
      localStorage.removeItem(storageKey);
      state = blankState();
      window.location.reload();
    });
    const sidebar = document.querySelector("#sidebar");
    const toggle = document.querySelector("#nav-toggle");
    toggle.addEventListener("click", () => {
      const open = sidebar.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    });
    document.querySelectorAll("#site-nav a").forEach((link) => link.addEventListener("click", () => {
      sidebar.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    }));
    document.addEventListener("click", (event) => {
      if (window.innerWidth > 820 || !sidebar.classList.contains("open") || sidebar.contains(event.target)) return;
      sidebar.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  }

  function renderTraceability() {
    const personaSelect = document.querySelector("#persona-filter");
    [...discovery.personas, { id: "cross-role", label: "Cross-Role" }, { id: "general", label: "All personas" }].forEach((persona) => personaSelect.add(new Option(persona.label, persona.id)));
    const categorySelect = document.querySelector("#category-filter");
    [...new Set(cases.map((testCase) => testCase.category))].sort().forEach((category) => categorySelect.add(new Option(category, category)));
    document.querySelector("#traceability-table").innerHTML = cases.map((testCase) => {
      const persona = personaMap.get(testCase.persona);
      return `<tr data-trace-case="${escapeHtml(testCase.id)}"><td><a href="#${testCase.persona === "cross-role" ? "cross-role" : testCase.persona === "general" ? "responsive-tests" : `${testCase.persona}-guide`}">${escapeHtml(testCase.id)}</a></td><td>${escapeHtml(persona.label)}</td><td>${escapeHtml(persona.permissions.join(", "))}</td><td>${escapeHtml(testCase.feature)}</td><td>${escapeHtml(testCase.scenario)}</td><td>${escapeHtml(testCase.priority)}</td><td>${escapeHtml(testCase.confidence)}</td><td data-trace-status>${escapeHtml(resultFor(testCase.id).status)}</td></tr>`;
    }).join("");
    ["case-search", "persona-filter", "category-filter", "status-filter"].forEach((id) => document.querySelector(`#${id}`).addEventListener("input", applyFilters));
    document.querySelector("#clear-filters").addEventListener("click", () => {
      document.querySelector("#case-search").value = "";
      document.querySelector("#persona-filter").value = "all";
      document.querySelector("#category-filter").value = "all";
      document.querySelector("#status-filter").value = "all";
      applyFilters();
    });
  }

  function updateTraceabilityStatuses() {
    document.querySelectorAll("[data-trace-case]").forEach((row) => {
      row.querySelector("[data-trace-status]").textContent = resultFor(row.dataset.traceCase).status;
    });
  }

  function matchesFilters(testCase) {
    const query = document.querySelector("#case-search").value.trim().toLowerCase();
    const persona = document.querySelector("#persona-filter").value;
    const category = document.querySelector("#category-filter").value;
    const status = document.querySelector("#status-filter").value;
    const searchable = [testCase.id, testCase.purpose, testCase.feature, testCase.category, testCase.scenario, ...testCase.tags].join(" ").toLowerCase();
    return (!query || searchable.includes(query)) && (persona === "all" || testCase.persona === persona) && (category === "all" || testCase.category === category) && (status === "all" || resultFor(testCase.id).status === status);
  }

  function applyFilters() {
    const matched = new Set(cases.filter(matchesFilters).map((item) => item.id));
    document.querySelectorAll(".test-case").forEach((element) => element.classList.toggle("hidden-by-filter", !matched.has(element.dataset.caseId)));
    document.querySelectorAll("[data-trace-case]").forEach((row) => row.classList.toggle("hidden-by-filter", !matched.has(row.dataset.traceCase)));
    document.querySelector("#filter-summary").textContent = `Showing ${matched.size} of ${cases.length} unique test cases. Filters also apply to persona sections above.`;
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
  }

  function download(name, content, type) {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function bindExportImport() {
    document.querySelector("#export-json").addEventListener("click", () => {
      const payload = { exportedAt: new Date().toISOString(), guideVersion: discovery.version, assessedCommit: discovery.assessedCommit, ...state };
      download(`uat-results-${discovery.version}.json`, JSON.stringify(payload, null, 2), "application/json");
    });
    document.querySelector("#export-csv").addEventListener("click", () => {
      const headers = ["testCaseId", "persona", "category", "priority", "feature", "status", "tester", "testDate", "defect", "actualResult", "evidenceComplete"];
      const rows = cases.map((testCase) => {
        const result = resultFor(testCase.id);
        return [testCase.id, personaMap.get(testCase.persona).label, testCase.category, testCase.priority, testCase.feature, result.status, result.tester, result.date, result.defect, result.actualResult, testCase.evidence.every((_, index) => result.evidence[index]) ? "Yes" : "No"];
      });
      download(`uat-results-${discovery.version}.csv`, [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv;charset=utf-8");
    });
    document.querySelector("#import-json").addEventListener("change", async (event) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const imported = JSON.parse(await file.text());
        if (imported.guideVersion !== discovery.version && imported.version !== discovery.version) throw new Error("Guide version does not match");
        if (!imported.results || typeof imported.results !== "object") throw new Error("Results are missing");
        const knownIds = new Set(cases.map((testCase) => testCase.id));
        const validResults = Object.fromEntries(Object.entries(imported.results).filter(([id, value]) => knownIds.has(id) && value && statuses.includes(value.status)));
        state = { ...blankState(), ...imported, version: discovery.version, results: validResults, run: imported.run || {}, accounts: imported.accounts || {} };
        localStorage.setItem(storageKey, JSON.stringify(state));
        showToast(`Imported ${Object.keys(validResults).length} results`);
        setTimeout(() => window.location.reload(), 450);
      } catch (error) {
        showToast(`Import failed: ${error.message}`);
      } finally {
        event.target.value = "";
      }
    });
  }

  function applyPrintMode() {
    const printMode = new URLSearchParams(window.location.search).get("print");
    if (!printMode) return;
    document.body.classList.add(`print-${printMode}`);
    document.querySelectorAll(".test-case").forEach((details) => { details.open = true; });
    document.title = `${printMode === "all" ? "Complete" : personaMap.get(printMode)?.label || printMode} UAT Guide`;
  }

  function bindActiveNav() {
    if (!("IntersectionObserver" in window)) return;
    const links = [...document.querySelectorAll("#site-nav a")];
    const byId = new Map(links.map((link) => [link.getAttribute("href").slice(1), link]));
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.remove("active"));
      byId.get(visible.target.id)?.classList.add("active");
    }, { rootMargin: "-20% 0px -65% 0px", threshold: [0, .15, .5] });
    document.querySelectorAll("main > section[id]").forEach((section) => observer.observe(section));
  }

  renderStaticContent();
  renderCases();
  renderTraceability();
  bindGeneralControls();
  bindExportImport();
  updateDashboard();
  applyFilters();
  applyPrintMode();
  bindActiveNav();
})();
