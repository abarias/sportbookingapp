/* global GUIDE_CONTENT */

const content = window.GUIDE_CONTENT;
const main = document.querySelector("#main-content");
const params = new URLSearchParams(window.location.search);
const selectedPersona = params.get("persona") || "all";
const printMode = params.get("print") === "1";
const personaPdf = {
  customer: "customer-user-guide.pdf",
  "super-admin": "super-admin-user-guide.pdf",
  "booking-admin": "booking-admin-user-guide.pdf",
  receptionist: "receptionist-user-guide.pdf",
  "social-media": "social-media-user-guide.pdf"
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function personaUrl(id) {
  return id === "all" ? "./" : `?persona=${encodeURIComponent(id)}`;
}

function screenshotMarkup(image) {
  return `<figure class="guide-shot">
    <button type="button" class="shot-button" data-image="assets/screenshots/${escapeHtml(image.file)}" data-caption="${escapeHtml(image.caption)}">
      <img src="assets/screenshots/${escapeHtml(image.file)}" alt="${escapeHtml(image.alt)}" loading="lazy" />
      <span>Open full-size image</span>
    </button>
    <figcaption>${escapeHtml(image.caption)}</figcaption>
  </figure>`;
}

function scenarioMarkup(scenario, persona) {
  return `<article class="scenario" id="${escapeHtml(scenario.id)}" data-search="${escapeHtml(`${scenario.id} ${scenario.title} ${scenario.summary} ${scenario.tags.join(" ")}`.toLowerCase())}">
    <header class="scenario-header">
      <div><span class="scenario-id">${escapeHtml(scenario.id)}</span><h3>${escapeHtml(scenario.title)}</h3></div>
      <span class="scenario-tag">${escapeHtml(scenario.category)}</span>
    </header>
    <p class="scenario-summary">${escapeHtml(scenario.summary)}</p>
    <div class="scenario-meta">
      <div><strong>Before you start</strong><p>${escapeHtml(scenario.precondition)}</p></div>
      <div><strong>What you need</strong><p>${escapeHtml(scenario.requirement)}</p></div>
    </div>
    <h4>Steps</h4>
    <ol class="steps">${scenario.steps.map((step) => `<li><span>${escapeHtml(step.action)}</span><aside><strong>Expected:</strong> ${escapeHtml(step.expected)}</aside></li>`).join("")}</ol>
    <div class="outcome"><strong>Finished when</strong><p>${escapeHtml(scenario.outcome)}</p></div>
    ${scenario.notes?.length ? `<div class="notes"><strong>Important notes</strong><ul>${scenario.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul></div>` : ""}
    ${scenario.screenshots?.length ? `<div class="screenshot-grid">${scenario.screenshots.map(screenshotMarkup).join("")}</div>` : ""}
    <a class="back-link" href="#persona-${escapeHtml(persona.id)}">Back to ${escapeHtml(persona.shortName)} contents</a>
  </article>`;
}

function personaMarkup(persona) {
  return `<section class="persona-section" id="persona-${escapeHtml(persona.id)}" style="--persona:${persona.color}">
    <header class="persona-hero">
      <div class="persona-icon" aria-hidden="true">${escapeHtml(persona.icon)}</div>
      <div><p class="eyebrow">Persona guide</p><h2>${escapeHtml(persona.name)}</h2><p>${escapeHtml(persona.introduction)}</p></div>
    </header>
    <div class="role-boundaries">
      <div class="can-do"><h3>Typical access</h3><ul>${persona.can.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
      <div class="cannot-do"><h3>Not included by default</h3><ul>${persona.cannot.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>
    </div>
    ${persona.id !== "customer" ? `<p class="permission-note"><strong>Permission note:</strong> ${escapeHtml(persona.permissionNote)}</p>` : ""}
    <nav class="scenario-index" aria-label="${escapeHtml(persona.name)} scenarios"><h3>Scenarios in this guide</h3>${persona.scenarios.map((scenario) => `<a href="#${escapeHtml(scenario.id)}"><span>${escapeHtml(scenario.id)}</span>${escapeHtml(scenario.title)}</a>`).join("")}</nav>
    <div class="scenario-list">${persona.scenarios.map((scenario) => scenarioMarkup(scenario, persona)).join("")}</div>
  </section>`;
}

function homeMarkup() {
  return `<section class="home-hero">
    <div><p class="eyebrow">Official platform documentation</p><h1>Book, manage, and support every facility visit with confidence.</h1><p class="hero-copy">Choose your role to see only the workflows that matter to you. Every scenario uses the labels shown in the booking platform and explains what should happen after each action.</p>
    <div class="hero-actions"><a class="primary-action" href="#personas">Choose your role</a><button class="secondary-action" type="button" data-print>Print complete guide</button></div></div>
    <aside><strong>Use this guide when you:</strong><ul><li>Make or manage a booking</li><li>Upload or verify payment proof</li><li>Change facilities, schedules, pricing, or access</li><li>Need to understand what your role can do</li></ul></aside>
  </section>
  <section class="start-section" id="getting-started"><p class="eyebrow">Before you start</p><h2>Four habits prevent most booking problems</h2><div class="habit-grid">${content.gettingStarted.map((item, index) => `<article><span>0${index + 1}</span><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p></article>`).join("")}</div></section>
  <section class="persona-picker" id="personas"><p class="eyebrow">Choose a guide</p><h2>Start with your platform role</h2><div class="persona-grid">${content.personas.map((persona) => `<a href="${personaUrl(persona.id)}" style="--persona:${persona.color}"><span class="persona-icon">${escapeHtml(persona.icon)}</span><strong>${escapeHtml(persona.name)}</strong><small>${escapeHtml(persona.cardDescription)}</small><b>Open guide</b></a>`).join("")}</div></section>
  <section class="downloads" aria-labelledby="download-title"><div><p class="eyebrow">Offline copies</p><h2 id="download-title">Download print-ready PDFs</h2><p>Use the complete manual or distribute only the guide relevant to each staff member or customer.</p></div><div class="download-links"><a href="downloads/complete-user-guide.pdf" download>Complete guide</a>${content.personas.map((persona) => `<a href="downloads/${personaPdf[persona.id]}" download>${escapeHtml(persona.name)}</a>`).join("")}</div></section>`;
}

function supportMarkup() {
  return `<section class="support" id="support"><div><p class="eyebrow">Help and support</p><h2>When something does not look right</h2><ol><li>Do not repeatedly click a booking, checkout, payment, or verification button.</li><li>Record the booking or order reference, page address, date, and time.</li><li>Take a screenshot without exposing passwords or private payment details.</li><li>Contact the designated MMG Stellar support or Super Admin.</li></ol></div><aside><h3>Include these details</h3><p>What you were trying to do, your role, the exact message shown, the booking/order reference, and whether refreshing the page changed the result.</p><p class="warning">Never send your password, verification code, service credentials, or full payment account details.</p></aside></section>`;
}

const activePersonas = selectedPersona === "all" ? content.personas : content.personas.filter((persona) => persona.id === selectedPersona);
if (activePersonas.length === 0) window.location.replace("./");

document.body.dataset.view = selectedPersona;
document.body.classList.toggle("print-mode", printMode);
main.innerHTML = `${selectedPersona === "all" ? homeMarkup() : `<section class="persona-page-heading"><a href="./">← All persona guides</a><div><a class="pdf-link" href="downloads/${personaPdf[selectedPersona]}" download>Download PDF</a><button type="button" data-print>Print or save as PDF</button></div></section>`}<div id="scenarios">${activePersonas.map(personaMarkup).join("")}</div>${supportMarkup()}`;
document.querySelector("#guide-version").textContent = content.version;

document.querySelectorAll("[data-print]").forEach((button) => button.addEventListener("click", () => window.print()));

const menuButton = document.querySelector(".menu-button");
const siteNav = document.querySelector("#site-nav");
menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!open));
  siteNav.classList.toggle("open", !open);
});
siteNav.addEventListener("click", () => { menuButton.setAttribute("aria-expanded", "false"); siteNav.classList.remove("open"); });

const dialog = document.querySelector("#image-dialog");
document.querySelectorAll(".shot-button").forEach((button) => button.addEventListener("click", () => {
  dialog.querySelector("img").src = button.dataset.image;
  dialog.querySelector("img").alt = button.querySelector("img").alt;
  dialog.querySelector("p").textContent = button.dataset.caption;
  dialog.showModal();
}));
dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });

if (printMode) window.addEventListener("load", () => document.querySelectorAll("img").forEach((image) => { image.loading = "eager"; }));
