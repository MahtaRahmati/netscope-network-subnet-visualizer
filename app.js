"use strict";

const Core = window.NetScopeCore;

const ipInput = document.querySelector("#ip-input");
const prefixInput = document.querySelector("#prefix-input");
const prefixRange = document.querySelector("#prefix-range");
const subnetForm = document.querySelector("#subnet-form");
const formError = document.querySelector("#form-error");
const validityBadge = document.querySelector("#validity-badge");

const networkAddress = document.querySelector("#network-address");
const broadcastAddress = document.querySelector("#broadcast-address");
const hostRange = document.querySelector("#host-range");
const usableHosts = document.querySelector("#usable-hosts");
const addressCountNote = document.querySelector("#address-count-note");
const subnetMask = document.querySelector("#subnet-mask");
const wildcardMask = document.querySelector("#wildcard-mask");
const addressScope = document.querySelector("#address-scope");
const legacyClass = document.querySelector("#legacy-class");
const blockSize = document.querySelector("#block-size");
const prefixLabel = document.querySelector("#prefix-label");

const binaryIp = document.querySelector("#binary-ip");
const binaryNetworkLabel = document.querySelector("#binary-network-label");
const binaryHostLabel = document.querySelector("#binary-host-label");

const positionPercent = document.querySelector("#position-percent");
const positionMarker = document.querySelector("#position-marker");
const positionNetwork = document.querySelector("#position-network");
const positionCurrent = document.querySelector("#position-current");
const positionBroadcast = document.querySelector("#position-broadcast");

const splitPrefix = document.querySelector("#split-prefix");
const splitButton = document.querySelector("#split-button");
const splitSummary = document.querySelector("#split-summary");
const splitTableBody = document.querySelector("#split-table-body");

const cidrCheatsheet = document.querySelector("#cidr-cheatsheet");

const vlsmBase = document.querySelector("#vlsm-base");
const vlsmRequirements = document.querySelector("#vlsm-requirements");
const vlsmButton = document.querySelector("#vlsm-button");
const vlsmError = document.querySelector("#vlsm-error");
const vlsmSummary = document.querySelector("#vlsm-summary");
const vlsmTableBody = document.querySelector("#vlsm-table-body");

const exportJsonButton = document.querySelector("#export-json-button");
const copySummaryButton = document.querySelector("#copy-summary-button");
const copyLinkButton = document.querySelector("#copy-link-button");
const themeToggle = document.querySelector("#theme-toggle");
const toast = document.querySelector("#toast");

let currentAnalysis = null;
let toastTimer = null;

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("show");
  }, 2200);
}

async function copyText(text, successMessage = "Copied") {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMessage);
  } catch (error) {
    console.error(error);
    showToast("Copy failed");
  }
}

function setBadge(message, isError = false) {
  validityBadge.textContent = message;
  validityBadge.classList.toggle("status-badge--error", isError);
}

function syncPrefix(value) {
  const prefix = Math.max(0, Math.min(32, Number(value)));
  prefixInput.value = prefix;
  prefixRange.value = prefix;
}

function updateUrl() {
  if (!currentAnalysis) return;
  const url = new URL(window.location.href);
  url.searchParams.set("ip", currentAnalysis.ip);
  url.searchParams.set("cidr", currentAnalysis.prefix);
  window.history.replaceState({}, "", url);
}

function renderBinary(analysis) {
  binaryIp.replaceChildren();

  [...analysis.binary].forEach((bit, index) => {
    const cell = document.createElement("span");
    cell.className = `bit ${index < analysis.prefix ? "bit--network" : "bit--host"}`;
    if ([7, 15, 23].includes(index)) {
      cell.classList.add("bit--octet-end");
    }
    cell.textContent = bit;
    cell.title = `Bit ${index + 1} · ${index < analysis.prefix ? "network" : "host"}`;
    binaryIp.append(cell);
  });

  binaryNetworkLabel.textContent = `Network bits: ${analysis.prefix}`;
  binaryHostLabel.textContent = `Host bits: ${32 - analysis.prefix}`;
}

function renderPosition(analysis) {
  const percent = Math.max(0, Math.min(100, analysis.position * 100));
  positionPercent.textContent = `${percent.toFixed(2)}%`;
  positionMarker.style.left = `${percent}%`;
  positionNetwork.textContent = analysis.network;
  positionCurrent.textContent = analysis.ip;
  positionBroadcast.textContent = analysis.broadcast;
}

function renderCheatsheet(prefix) {
  cidrCheatsheet.replaceChildren();

  const start = Math.max(0, prefix - 2);
  const end = Math.min(32, prefix + 2);

  for (let cidr = start; cidr <= end; cidr += 1) {
    const row = document.createElement("div");
    row.className = "cheat-row";

    const prefixText = document.createElement("strong");
    prefixText.textContent = `/${cidr}`;

    const mask = document.createElement("span");
    mask.textContent = Core.maskFromPrefix(cidr);

    const hosts = document.createElement("small");
    hosts.textContent = `${formatNumber(Core.usableCount(cidr))} usable`;

    row.append(prefixText, mask, hosts);
    cidrCheatsheet.append(row);
  }
}

function renderAnalysis(analysis) {
  currentAnalysis = analysis;

  networkAddress.textContent = `${analysis.network}/${analysis.prefix}`;
  broadcastAddress.textContent = analysis.broadcast;
  hostRange.textContent = `${analysis.firstHost} — ${analysis.lastHost}`;
  usableHosts.textContent = formatNumber(analysis.usableHosts);
  addressCountNote.textContent = `${formatNumber(analysis.totalAddresses)} total addresses`;
  subnetMask.textContent = analysis.mask;
  wildcardMask.textContent = analysis.wildcard;
  addressScope.textContent = analysis.scope;
  legacyClass.textContent = analysis.className;
  blockSize.textContent = formatNumber(analysis.totalAddresses);
  prefixLabel.textContent = `/${analysis.prefix} · ${32 - analysis.prefix} host bits`;

  renderBinary(analysis);
  renderPosition(analysis);
  renderCheatsheet(analysis.prefix);

  splitPrefix.min = Math.min(32, analysis.prefix + 1);
  if (Number(splitPrefix.value) <= analysis.prefix) {
    splitPrefix.value = Math.min(32, analysis.prefix + 2);
  }

  formError.textContent = "";
  setBadge("Valid IPv4");
  updateUrl();
}

function analyzeFromInputs() {
  try {
    const analysis = Core.calculateSubnet(ipInput.value.trim(), Number(prefixInput.value));
    syncPrefix(analysis.prefix);
    renderAnalysis(analysis);
    return analysis;
  } catch (error) {
    formError.textContent = error.message;
    setBadge("Invalid input", true);
    return null;
  }
}

function renderSplit() {
  if (!currentAnalysis && !analyzeFromInputs()) return;

  try {
    const result = Core.splitSubnet(
      currentAnalysis.ip,
      currentAnalysis.prefix,
      Number(splitPrefix.value),
      32
    );

    splitTableBody.replaceChildren();

    result.rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${row.index} · /${row.prefix}</td>
        <td>${row.network}</td>
        <td>${row.firstHost} — ${row.lastHost}</td>
        <td>${row.broadcast}</td>
      `;
      splitTableBody.append(tr);
    });

    splitSummary.textContent = result.truncated
      ? `${formatNumber(result.count)} total subnets. Showing the first ${result.rows.length}.`
      : `${formatNumber(result.count)} subnets · ${formatNumber(result.rows[0]?.usableHosts ?? 0)} usable addresses each.`;
  } catch (error) {
    splitSummary.textContent = error.message;
    splitTableBody.replaceChildren();
  }
}

function parseVlsmRequirements(text) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Add at least one requirement.");
  }

  return lines.map((line, index) => {
    const parts = line.split(/[:,]/);
    if (parts.length < 2) {
      throw new Error(`Line ${index + 1}: use "Segment name, hosts".`);
    }

    const hosts = Number(parts.pop().trim());
    const name = parts.join(",").trim();

    if (!name) {
      throw new Error(`Line ${index + 1}: segment name is missing.`);
    }

    if (!Number.isInteger(hosts) || hosts <= 0) {
      throw new Error(`Line ${index + 1}: host count must be a positive integer.`);
    }

    return { name, hosts };
  });
}

function makeSummaryCard(label, value, note) {
  const card = document.createElement("div");
  card.className = "vlsm-summary-card";

  const labelNode = document.createElement("span");
  labelNode.textContent = label;

  const valueNode = document.createElement("strong");
  valueNode.textContent = value;

  const noteNode = document.createElement("small");
  noteNode.textContent = note;

  card.append(labelNode, valueNode, noteNode);
  return card;
}

function renderVlsm() {
  try {
    const cidr = Core.parseCidr(vlsmBase.value);
    const requirements = parseVlsmRequirements(vlsmRequirements.value);
    const plan = Core.buildVlsmPlan(cidr.ip, cidr.prefix, requirements);

    vlsmError.textContent = "";
    vlsmSummary.replaceChildren(
      makeSummaryCard(
        "Allocated blocks",
        formatNumber(plan.allocations.length),
        `${formatNumber(plan.requestedHosts)} requested hosts`
      ),
      makeSummaryCard(
        "Address usage",
        `${plan.utilization.toFixed(1)}%`,
        `${formatNumber(plan.usedAddresses)} of ${formatNumber(plan.base.totalAddresses)} addresses`
      ),
      makeSummaryCard(
        "Remaining",
        formatNumber(plan.remainingAddresses),
        `Inside ${plan.base.network}/${plan.base.prefix}`
      )
    );

    vlsmTableBody.replaceChildren();

    plan.allocations.forEach((allocation) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(allocation.name)}</td>
        <td>${formatNumber(allocation.hosts)}</td>
        <td>/${allocation.prefix}</td>
        <td>${allocation.network}</td>
        <td>${allocation.firstHost} — ${allocation.lastHost}</td>
        <td>${allocation.broadcast}</td>
        <td>${formatNumber(allocation.waste)}</td>
      `;
      vlsmTableBody.append(tr);
    });
  } catch (error) {
    vlsmError.textContent = error.message;
    vlsmSummary.replaceChildren();
    vlsmTableBody.replaceChildren();
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function currentSummaryText() {
  if (!currentAnalysis) return "";

  return [
    `NetScope IPv4 analysis`,
    `IP: ${currentAnalysis.ip}/${currentAnalysis.prefix}`,
    `Network: ${currentAnalysis.network}/${currentAnalysis.prefix}`,
    `Broadcast: ${currentAnalysis.broadcast}`,
    `Usable range: ${currentAnalysis.firstHost} - ${currentAnalysis.lastHost}`,
    `Usable addresses: ${currentAnalysis.usableHosts}`,
    `Subnet mask: ${currentAnalysis.mask}`,
    `Wildcard: ${currentAnalysis.wildcard}`,
    `Scope: ${currentAnalysis.scope}`,
  ].join("\n");
}

function exportJson() {
  if (!currentAnalysis) return;

  const payload = {
    app: "NetScope",
    exportedAt: new Date().toISOString(),
    analysis: currentAnalysis,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `netscope-${currentAnalysis.ip.replaceAll(".", "-")}-${currentAnalysis.prefix}.json`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("JSON exported");
}

function loadFromQueryString() {
  const params = new URLSearchParams(window.location.search);
  const ip = params.get("ip");
  const cidr = params.get("cidr");

  if (ip) ipInput.value = ip;
  if (cidr !== null && cidr !== "") {
    syncPrefix(cidr);
  }
}

function loadTheme() {
  const saved = localStorage.getItem("netscope-theme");
  if (saved === "light" || saved === "dark") {
    document.documentElement.dataset.theme = saved;
    return;
  }

  const prefersLight = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  document.documentElement.dataset.theme = prefersLight ? "light" : "dark";
}

subnetForm.addEventListener("submit", (event) => {
  event.preventDefault();
  analyzeFromInputs();
});

prefixInput.addEventListener("input", () => syncPrefix(prefixInput.value));
prefixRange.addEventListener("input", () => {
  syncPrefix(prefixRange.value);
  analyzeFromInputs();
});

ipInput.addEventListener("change", analyzeFromInputs);

splitButton.addEventListener("click", renderSplit);
vlsmButton.addEventListener("click", renderVlsm);

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-copy-target]");
  if (!button) return;

  const target = document.getElementById(button.dataset.copyTarget);
  if (target) copyText(target.textContent.trim(), "Value copied");
});

exportJsonButton.addEventListener("click", exportJson);
copySummaryButton.addEventListener("click", () => {
  copyText(currentSummaryText(), "Summary copied");
});

copyLinkButton.addEventListener("click", () => {
  copyText(window.location.href, "Share link copied");
});

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "light" ? "dark" : "light";
  document.documentElement.dataset.theme = next;
  localStorage.setItem("netscope-theme", next);
});

loadTheme();
loadFromQueryString();
analyzeFromInputs();
renderSplit();
renderVlsm();
