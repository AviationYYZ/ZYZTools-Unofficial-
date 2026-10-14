const api = window.preferredCyyzPdc;

let config = null;
let parentFolder = "";
let installFolder = "";
let localSettingsFolder = "";
let installed = false;
let currentStatistics = null;
let currentAppVersion = '';
let betaPublished = false;
let pluginFolderName = 'PreferredCYYZPdcPlugin';
let appDisplayName = 'ZYZTools';
let customTheme = window.ZyzCustomTheme.normalize();
const customFields = { background: 'customBackground', header: 'customHeader', navigation: 'customNavigation', panel: 'customPanel', text: 'customText', muted: 'customMuted', accent: 'customAccent', title: 'customTitle', font: 'customFont', layout: 'customLayout', titleSize: 'customTitleSize', radius: 'customRadius', titleCase: 'customTitleCase' };

const $ = (id) => document.getElementById(id);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setStatus(text, kind = "info") {
  const el = $("status");
  el.textContent = text;
  el.className = kind === "info" ? "status" : `status ${kind}`;
}

function setInstalled(value) {
  installed = !!value;
  $("installedPill").textContent = installed ? "PLUGIN LINKED" : "APP ONLY";
  $("installedPill").style.borderColor = installed ? "#4e8059" : "#80693e";
  $("installedPill").style.color = installed ? "#bde5c2" : "#f1d49a";
}

function normalizeTheme(value) {
  const theme = String(value || "current").trim().toLowerCase();
  if (theme === "vatcan" || theme === "vatcansitu") return "vatcan";
  if (theme === "navcan" || theme === "navcanada") return "navcan";
  if (theme === "custom") return "custom";
  if (theme === "cpp" || theme === "plugincore" || theme === "plugin_core" || theme === "core") return "plugincore";
  return "current";
}

function applyTheme(value) {
  const theme = normalizeTheme(value);
  document.body.dataset.theme = theme;
  for (const key of Object.keys(window.ZyzCustomTheme.variables(customTheme))) document.body.style.removeProperty(key);
  if (theme === 'custom') {
    for (const [key, value] of Object.entries(window.ZyzCustomTheme.variables(customTheme))) document.body.style.setProperty(key, value);
    document.body.dataset.customLayout = customTheme.layout;
  } else delete document.body.dataset.customLayout;
  $('customThemeEditor').hidden = theme !== 'custom';
  updateThemeTitle();
  if ($("uiTheme")) $("uiTheme").value = theme;
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    const selected = button.dataset.themeChoice === theme;
    button.classList.toggle('primary', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function updateThemeTitle() {
  const brand = document.createElement('span'); brand.className = 'brand-name';
  for (const word of ['ZYZ', 'Tools']) { const span = document.createElement('span'); span.textContent = word; brand.append(span); }
  $('appTitle').replaceChildren(brand);
  if (/\btest\b/i.test(appDisplayName)) {
    const badge = document.createElement('span'); badge.className = 'brand-test'; badge.textContent = 'test'; $('appTitle').append(badge);
  }
  $('appTitle').setAttribute('aria-label', appDisplayName);
}
function customThemeToForm() {
  for (const [key, id] of Object.entries(customFields)) $(id).value = customTheme[key];
}
function previewCustomTheme() {
  customTheme = window.ZyzCustomTheme.normalize(Object.fromEntries(Object.entries(customFields).map(([key, id]) => [key, $(id).value])));
  applyTheme('custom');
}

function normalizeListText(value) {
  return String(value || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .join(" ");
}

function boolInt(id) {
  return $(id).checked ? 1 : 0;
}

function setBool(id, value) {
  $(id).checked = !!Number(value);
}

function numberValue(id, min, max, fallback) {
  const parsed = Number.parseInt($(id).value, 10);
  if (Number.isNaN(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function updateResolvedPath() {
  const trimmed = String(parentFolder || "").replace(/[\\/]+$/, "");
  installFolder = trimmed.toLowerCase().endsWith(pluginFolderName.toLowerCase())
    ? trimmed
    : `${trimmed.replace(/[\\/](preferredcyyzpdcplugin|zyztools-test)$/i, '')}\\${pluginFolderName}`;
  $("installFolder").textContent = installFolder;
}

function commandSuffix() {
  let value = $("saveCommand").value.trim();
  while (value.startsWith(".")) value = value.slice(1).trim();
  value = value.replace(/\s+/g, " ");
  return value || "replay save";
}

function updateTxRadioIntensityLabel() {
  const value = numberValue("txRadioIntensity", 0, 100, 70);
  $("txRadioIntensityValue").textContent = `${value}%`;
}

function formToConfig() {
  const next = structuredClone(config);
  next.hoppie_enabled = boolInt("hoppieEnabled");
  next.hoppie_logon_code = $("logonCode").value.trim();
  next.station_code = $("stationCode").value.trim().toUpperCase() || "CYYZ";
  next.poll_seconds = numberValue("pollSeconds", 45, 75, 60);
  next.runway_assignment_config = $("runwayAssignmentConfig").value;
  if (next.runway_assignment_config !== "off") {
    next.airport_direction = next.runway_assignment_config.toUpperCase();
    next.operation = "DUALS";
  }
  next.ui_theme = normalizeTheme($("uiTheme").value);
  next.arrival_assignment_enabled = boolInt('arrivalAssignmentEnabled');
  next.arrival_assignment_flow = $('arrivalAssignmentFlow').value;
  next.duals_mode = next.runway_assignment_config === "east" ? "05"
    : next.runway_assignment_config === "west" ? "23" : "off";
  next.pdc_template_bridge = window.pdcTemplates.validate($('pdcTemplateBridge').value);
  next.pdc_template_hoppie = window.pdcTemplates.validate($('pdcTemplateHoppie').value);
  next.confirm_every_pdc = boolInt("confirmEveryPdc");
  next.pdc_sound_enabled = boolInt("pdcSoundEnabled");
  next.ifr_sound_enabled = boolInt("ifrSoundEnabled");
  next.send_sound_enabled = boolInt("sendSoundEnabled");
  next.audio_replay_enabled = boolInt("audioReplayEnabled");
  next.audio_replay_seconds = numberValue("replayMinutes", 1, 10, 3) * 60;
  next.audio_replay_tx_radio_intensity = numberValue("txRadioIntensity", 0, 100, 70);
  next.audio_replay_capture_mode = "process";
  next.audio_replay_processes = "trackaudio.exe";
  next.audio_replay_folder = $("recordingsFolder").value.trim() || "Recordings";
  next.audio_replay_save_command = commandSuffix();
  next.trackaudio_version = $("trackAudioVersion").value;
  next.test_mode = boolInt("testMode");
  next.debug_mode = boolInt("debugMode");
  next.pdc_request_sound = $("pdcSound").value.trim() || "pdc_request.wav";
  next.ifr_release_sound = $("ifrSound").value.trim() || "IFR_release.wav";
  next.send_sound = $("sendSound").value.trim() || "pdc_send.wav";
  next.runway_assignments = next.runway_assignments || { west: {}, east: {} };
  next.runway_assignments.west = next.runway_assignments.west || {};
  next.runway_assignments.east = next.runway_assignments.east || {};
  next.runway_assignments.west["23"] = normalizeListText($("west23").value).split(" ").filter(Boolean);
  next.runway_assignments.west["24R"] = normalizeListText($("west24r").value).split(" ").filter(Boolean);
  next.runway_assignments.east["05"] = normalizeListText($("east05").value).split(" ").filter(Boolean);
  next.runway_assignments.east["06L"] = normalizeListText($("east06l").value).split(" ").filter(Boolean);
  return next;
}

function configToForm(next) {
  config = next;
  $("hoppieEnabled").checked = !!Number(config.hoppie_enabled);
  $("logonCode").value = config.hoppie_logon_code || "";
  $("stationCode").value = config.station_code || "CYYZ";
  $("pollSeconds").value = config.poll_seconds || 60;
  $("runwayAssignmentConfig").value = config.runway_assignment_config || "off";
  setBool('arrivalAssignmentEnabled', config.arrival_assignment_enabled);
  $('arrivalAssignmentFlow').value = config.arrival_assignment_flow || 'west';
  $('arrivalAssignmentFlow').disabled = !Number(config.arrival_assignment_enabled);
  applyTheme(config.ui_theme || "current");
  $('pdcTemplateBridge').value = config.pdc_template_bridge || window.pdcTemplates.defaults.bridge;
  $('pdcTemplateHoppie').value = config.pdc_template_hoppie || window.pdcTemplates.defaults.hoppie;
  setBool("confirmEveryPdc", config.confirm_every_pdc);
  setBool("pdcSoundEnabled", config.pdc_sound_enabled);
  setBool("ifrSoundEnabled", config.ifr_sound_enabled);
  setBool("sendSoundEnabled", config.send_sound_enabled);
  setBool("audioReplayEnabled", config.audio_replay_enabled);
  $("replayMinutes").value = Math.max(1, Math.min(10, Math.ceil((config.audio_replay_seconds || 180) / 60)));
  $("txRadioIntensity").value = Math.max(0, Math.min(100, config.audio_replay_tx_radio_intensity ?? 70));
  updateTxRadioIntensityLabel();
  $("recordingsFolder").value = config.audio_replay_folder || "Recordings";
  $("saveCommand").value = String(config.audio_replay_save_command || "replay save").replace(/^\.+/, "");
  $("trackAudioVersion").value = config.trackaudio_version || "auto";
  setBool("testMode", config.test_mode);
  setBool("debugMode", config.debug_mode);
  $("pdcSound").value = config.pdc_request_sound || "pdc_request.wav";
  $("ifrSound").value = config.ifr_release_sound || "IFR_release.wav";
  $("sendSound").value = config.send_sound || "pdc_send.wav";

  const matrix = config.runway_assignments || { west: {}, east: {} };
  $("west23").value = ((matrix.west && matrix.west["23"]) || []).join(" ");
  $("west24r").value = ((matrix.west && matrix.west["24R"]) || []).join(" ");
  $("east05").value = ((matrix.east && matrix.east["05"]) || []).join(" ");
  $("east06l").value = ((matrix.east && matrix.east["06L"]) || []).join(" ");
}

async function saveConfig(message = "Settings saved.") {
  customTheme = await api.saveCustomTheme(customTheme);
  config = formToConfig();
  if (installed) {
    config = await api.saveInstalledConfig(installFolder, config);
  } else {
    config = await api.saveLocalConfig(config);
  }
  configToForm(config);
  setStatus(message, "success");
  await refreshRecordings(false);
  await refreshTrackAudioTapStatus(false);
  await refreshStatistics(false);
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.ceil(bytes / 1024))} KB`;
}

async function refreshRecordings(showStatus = true) {
  const result = await api.listRecordings(installFolder, formToConfig());
  $("recordingsPath").textContent = result.folder;
  const tbody = $("recordingsTable");
  if (!result.files.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="subtle">No recordings saved yet.</td></tr>`;
  } else {
    tbody.innerHTML = result.files.slice(0, 20).map((file) => `
      <tr>
        <td title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</td>
        <td>${formatBytes(file.size)}</td>
        <td><button data-play="${encodeURIComponent(file.path)}">Play</button></td>
      </tr>
    `).join("");
  }
  if (showStatus) setStatus("Recordings refreshed.", "success");
}

function summaryNumber(summary, key, digits = 0) {
  const value = Number(summary && summary[key]);
  if (!Number.isFinite(value)) return digits ? "0.0" : "0";
  return value.toFixed(digits);
}

function setStatisticsButtons(enabled) {
  $("openLatestStatisticsBtn").disabled = !enabled;
  $("downloadLatestStatisticsBtn").disabled = !enabled;
}

function renderStatisticsEmpty(message) {
  $("statisticsLatest").textContent = message;
  $("statsCleared").textContent = "0";
  $("statsDeparted").textContent = "0";
  $("statsLanded").textContent = "0";
  $("statsMovementsHour").textContent = "0.0";
  $("statisticsChart").innerHTML = `<div class="subtle">No traffic-volume buckets yet.</div>`;
  $("statisticsEventsTable").innerHTML = `<tr><td colspan="5" class="subtle">No movement events yet.</td></tr>`;
  $("statisticsFilesTable").innerHTML = `<tr><td colspan="3" class="subtle">No statistics spreadsheets saved yet.</td></tr>`;
  setStatisticsButtons(false);
}

function renderStatistics(result) {
  currentStatistics = result;
  $("statisticsPath").textContent = result.folder;

  if (!result.latest) {
    renderStatisticsEmpty("No statistics spreadsheet has been exported yet. Connect EuroScope to the network to start recording, or use .STATS EXPORT while connected.");
    return;
  }

  const latest = result.latest;
  const summary = latest.summary || {};
  const latestLines = [
    latest.name,
    summary.Status ? `Status: ${summary.Status}` : null,
    summary.Controller ? `Controller: ${summary.Controller}` : null,
    summary["Session start"] ? `Start: ${summary["Session start"]}` : null,
    summary["Session end"] ? `End: ${summary["Session end"]}` : null,
    latest.parseError ? `Parse warning: ${latest.parseError}` : null
  ].filter(Boolean);
  $("statisticsLatest").textContent = latestLines.join("\n");
  $("statsCleared").textContent = summaryNumber(summary, "Aircraft cleared");
  $("statsDeparted").textContent = summaryNumber(summary, "Aircraft departed");
  $("statsLanded").textContent = summaryNumber(summary, "Aircraft landed");
  $("statsMovementsHour").textContent = summaryNumber(summary, "Average movements per hour", 1);
  setStatisticsButtons(true);

  const buckets = (latest.trafficVolume || []).slice(-16);
  if (!buckets.length) {
    $("statisticsChart").innerHTML = `<div class="subtle">No traffic-volume buckets yet.</div>`;
  } else {
    const maxMovements = Math.max(1, ...buckets.map((bucket) => Number(bucket.Movements) || 0));
    $("statisticsChart").innerHTML = buckets.map((bucket) => {
      const movements = Number(bucket.Movements) || 0;
      const width = movements > 0 ? Math.max(2, Math.round((movements / maxMovements) * 100)) : 0;
      return `
        <div class="bar-row">
          <div title="${escapeHtml(bucket["Interval start"] || "")}">${escapeHtml(bucket["Interval start"] || "")}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${width}%"></div></div>
          <div>${movements}</div>
        </div>
      `;
    }).join("");
  }

  const events = (latest.events || []).slice(-12).reverse();
  $("statisticsEventsTable").innerHTML = events.length
    ? events.map((event) => `
      <tr>
        <td title="${escapeHtml(event.Timestamp)}">${escapeHtml(event.Timestamp)}</td>
        <td>${escapeHtml(event.Event)}</td>
        <td>${escapeHtml(event.Callsign)}</td>
        <td>${escapeHtml(event.Runway)}</td>
        <td title="${escapeHtml(event["Detection Source"])}">${escapeHtml(event["Detection Source"])}</td>
      </tr>
    `).join("")
    : `<tr><td colspan="5" class="subtle">No movement events yet.</td></tr>`;

  $("statisticsFilesTable").innerHTML = result.files.length
    ? result.files.slice(0, 20).map((file) => `
      <tr>
        <td title="${escapeHtml(file.path)}">${escapeHtml(file.name)}</td>
        <td>${formatBytes(file.size)}</td>
        <td><button data-open-stats="${encodeURIComponent(file.path)}">Open</button></td>
      </tr>
    `).join("")
    : `<tr><td colspan="3" class="subtle">No statistics spreadsheets saved yet.</td></tr>`;
}

async function refreshStatistics(showStatus = true) {
  try {
    const result = await api.listStatistics(installFolder);
    renderStatistics(result);
    if (showStatus) setStatus("Statistics refreshed.", "success");
  } catch (error) {
    $("statisticsPath").textContent = `${installFolder}\\Statistics`;
    renderStatisticsEmpty(`Could not load statistics: ${error.message}`);
    if (showStatus) setStatus(error.message, "error");
  }
}

function shortTrackAudioTarget(targetPath) {
  const text = String(targetPath || "");
  if (text.includes("app.asar.unpacked")) return "app.asar.unpacked native module";
  if (text.toLowerCase().endsWith("\\afv_native.dll")) return "TrackAudio root native module";
  return text || "native module";
}

function formatTrackAudioTapStatus(result) {
  if (!result) return "";
  const targetSummary = (result.targets || [])
    .filter((target) => target.exists)
    .map((target) => `${shortTrackAudioTarget(target.path)}: ${target.patched ? "patched" : "stock / needs repair"}`)
    .join("\n");
  return `${result.message}${targetSummary ? `\n${targetSummary}` : ""}`;
}

async function refreshTrackAudioTapStatus(showStatus = false) {
  const result = await api.trackAudioStatus($("trackAudioVersion").value);
  $("trackAudioTapStatus").textContent = formatTrackAudioTapStatus(result);
  if (showStatus) setStatus(result.message, result.ready ? "success" : "error");
  return result;
}

async function boot() {
  const state = await api.initialState();
  appDisplayName = state.appDisplayName;
  customTheme = window.ZyzCustomTheme.normalize(state.customTheme);
  customThemeToForm();
  pluginFolderName = state.pluginFolderName;
  $("appTitle").textContent = state.appDisplayName;
  document.title = state.appDisplayName;
  currentAppVersion = state.appVersion;
  $("testPublishPanel").hidden = !state.isTestBuild;
  parentFolder = state.defaultParentFolder;
  installFolder = state.installFolder;
  localSettingsFolder = state.localSettingsFolder;
  setInstalled(state.installed);
  $("parentFolder").value = parentFolder;
  $("installFolder").textContent = installFolder;
  configToForm(state.config);
  setStatus("Ready. Use Install / Update EuroScope Plugin after changing destination or settings.");
  checkUpdates();
  await refreshRecordings(false);
  await refreshTrackAudioTapStatus(false);
  await refreshStatistics(false);
}

document.querySelectorAll("nav button[data-tab]").forEach((button) => {
  button.addEventListener("click", async () => {
    document.querySelectorAll("nav button[data-tab]").forEach((item) => {
      item.classList.toggle("primary", item === button);
      if (item === button) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    document.querySelectorAll("section").forEach((section) => section.classList.remove("active"));
    $(button.dataset.tab).classList.add("active");
    if (button.dataset.tab === "statistics") {
      await refreshStatistics(false);

    } else if (button.dataset.tab === "replay") {
      await refreshRecordings(false);
      await refreshTrackAudioTapStatus(false);
    }
  });
});

$("parentFolder").addEventListener("input", () => {
  parentFolder = $("parentFolder").value;
  updateResolvedPath();
});

$("uiTheme").addEventListener("change", () => {
  applyTheme($("uiTheme").value);
});
document.querySelectorAll('[data-theme-choice]').forEach(button => {
  button.addEventListener('click', () => applyTheme(button.dataset.themeChoice));
});
customThemeToForm();
updateThemeTitle();
for (const id of Object.values(customFields)) {
  $(id).addEventListener('input', previewCustomTheme);
  $(id).addEventListener('change', previewCustomTheme);
}
$('resetCustomThemeBtn').addEventListener('click', () => { customTheme = window.ZyzCustomTheme.normalize(); customThemeToForm(); applyTheme('custom'); });
$('saveCustomThemeBtn').addEventListener('click', () => saveConfig('Appearance saved.').catch(error => setStatus(error.message, 'error')));

$("browseBtn").addEventListener("click", async () => {
  const result = await api.browseParentFolder(parentFolder);
  if (result.canceled) return;
  parentFolder = result.parentFolder;
  installFolder = result.installFolder;
  $("parentFolder").value = parentFolder;
  $("installFolder").textContent = installFolder;
  configToForm(await api.loadConfig(installFolder));
  await refreshRecordings(false);
  await refreshTrackAudioTapStatus(false);
  await refreshStatistics(false);
});

$("installPluginBtn").addEventListener("click", async () => {
  try {
    const result = await api.installPlugin(parentFolder, formToConfig());
    installFolder = result.destination;
    $("installFolder").textContent = installFolder;
    configToForm(result.config);
    setInstalled(true);
    setStatus(`EuroScope plugin installed. ${result.tapStatus}`, "success");
    await refreshRecordings(false);
    await refreshTrackAudioTapStatus(false);
    await refreshStatistics(false);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("openInstallBtn").addEventListener("click", () => api.openFolder(installFolder));
$("openLocalSettingsBtn").addEventListener("click", () => api.openFolder(localSettingsFolder));

['savePdcTemplatesBtn', 'saveArrivalSettingsBtn', "saveOperationsBtn", "saveHoppieBtn", "saveSidsBtn", "saveReplaySettingsBtn", "saveAdvancedBtn", "saveAppearanceBtn"].forEach((id) => {
  $(id).addEventListener("click", () => saveConfig().catch(error => setStatus(error.message, 'error')));
});

$("audioStatusBtn").addEventListener("click", async () => {
  try {
    setStatus(await api.audioReplayCommand("status"), "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("trackAudioVersion").addEventListener("change", () => refreshTrackAudioTapStatus(true));
$('arrivalAssignmentEnabled').addEventListener('change', () => { $('arrivalAssignmentFlow').disabled = !$('arrivalAssignmentEnabled').checked; });
$("trackAudioStatusBtn").addEventListener("click", () => refreshTrackAudioTapStatus(true));
$("txRadioIntensity").addEventListener("input", updateTxRadioIntensityLabel);
$("txRadioIntensity").addEventListener("change", () => saveConfig('Controller filter intensity applied. New captured audio uses this setting.').catch(error => setStatus(error.message, 'error')));

$("applyTrackAudioTapBtn").addEventListener("click", async () => {
  try {
    const result = await api.applyTrackAudioTap($("trackAudioVersion").value);
    $("trackAudioTapStatus").textContent = formatTrackAudioTapStatus(result);
    setStatus(result.applyMessage || result.message, result.ready ? "success" : "error");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("saveReplayBtn").addEventListener("click", async () => {
  try {
    const response = await api.audioReplayCommand("save");
    setStatus(response, "success");
    await refreshRecordings(false);
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("refreshRecordingsBtn").addEventListener("click", () => refreshRecordings(true));

$("refreshStatisticsBtn").addEventListener("click", () => refreshStatistics(true));
$("openStatisticsFolderBtn").addEventListener("click", async () => {
  const folder = currentStatistics && currentStatistics.folder
    ? currentStatistics.folder
    : `${installFolder}\\Statistics`;
  await api.openFolder(folder);
});

$("openLatestStatisticsBtn").addEventListener("click", async () => {
  try {
    if (!currentStatistics || !currentStatistics.latest) {
      throw new Error("No statistics spreadsheet has been exported yet.");
    }
    await api.openStatistics(currentStatistics.latest.path);
    setStatus("Latest statistics spreadsheet opened.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("downloadLatestStatisticsBtn").addEventListener("click", async () => {
  try {
    const result = await api.saveLatestStatistics(installFolder);
    if (result.canceled) return;
    setStatus(`Latest statistics spreadsheet saved to ${result.path}`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("recordingsTable").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-play]");
  if (!button) return;
  try {
    await api.playRecording(decodeURIComponent(button.dataset.play));
    setStatus("Recording opened in your default WAV player.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

$("statisticsFilesTable").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-open-stats]");
  if (!button) return;
  try {
    await api.openStatistics(decodeURIComponent(button.dataset.openStats));
    setStatus("Statistics spreadsheet opened.", "success");
  } catch (error) {
    setStatus(error.message, "error");
  }
});

boot().catch((error) => setStatus(error.message, "error"));

async function checkUpdates() {
  $("checkUpdatesBtn").disabled = true;
  $("installUpdateBtn").hidden = true;
  $("updateStatus").textContent = 'Checking GitHub releases…';
  try {
    const result = await api.checkUpdates($("updateStream").value);
    $("updateStatus").textContent = result.message;
    $("installUpdateBtn").hidden = !result.available;
    if (result.currentVersionPublished) {
      betaPublished = true;
      $("publishTestBtn").disabled = true;
      $("publishStatus").textContent = `Beta ${currentAppVersion} is already published.`;
    }
  } catch (error) { $("updateStatus").textContent = error.message; }
  finally { $("checkUpdatesBtn").disabled = false; }
}
$("checkUpdatesBtn").addEventListener('click', checkUpdates);
$("installUpdateBtn").addEventListener('click', async () => {
  $("installUpdateBtn").disabled = true;
  $("updateStatus").textContent = 'Downloading the latest installer…';
  try { await api.installUpdate(); }
  catch (error) { $("updateStatus").textContent = error.message; $("installUpdateBtn").disabled = false; }
});

async function publishBeta(options = {}) {
  $("publishTestBtn").disabled = true;
  $("publishConfirmBtn").disabled = true;
  $("publishStatus").textContent = "Preparing " + $("publishStream").value + " publication…";
  try {
    const result = await api.publishTest({ ...options, stream: $("publishStream").value, essential: $("publishPriority").value === 'essential' });
    if (result.needsAuth) {
      $("publishAuth").hidden = false;
      $("publishToken").focus();
      $("publishStatus").textContent = "Connect GitHub to publish the selected stream.";
      return;
    }
    if (result.canceled) { $("publishStatus").textContent = "Canceled. Nothing published."; return; }
    betaPublished = false;
    $("publishAuth").hidden = true;
    $("publishStatus").textContent = result.authWarning || ($("publishStream").value + " " + result.version + " published: " + result.url);
    setStatus($("publishStatus").textContent, "success");
    await checkUpdates();
  } catch (error) {
    $("publishAuth").hidden = false;
    $("publishStatus").textContent = error.message.replace(/^Error invoking remote method[^:]+: (?:Error: )?/, "");
  } finally {
    $("publishTestBtn").disabled = betaPublished;
    $("publishConfirmBtn").disabled = betaPublished;
  }
}
$("publishTestBtn").addEventListener("click", () => publishBeta());
$("publishStream").addEventListener('change', () => { betaPublished = false; $("publishTestBtn").disabled = false; $("publishConfirmBtn").disabled = false; });
$("updateStream").value = localStorage.getItem('updateStream') || 'stable';
$("updateStream").addEventListener('change', () => { localStorage.setItem('updateStream', $("updateStream").value); checkUpdates(); });
$("openGitHubTokenBtn").addEventListener("click", () => api.openTokenSettings());
$("publishConfirmBtn").addEventListener("click", () => {
  const token = $("publishToken").value.trim();
  $("publishToken").value = "";
  if (!token) { $("publishStatus").textContent = "Paste your GitHub token first."; return; }
  publishBeta({ token, remember: $("rememberPublishing").checked });
});

document.querySelectorAll('[data-plugin-action]').forEach(button => {
  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      await saveConfig();
      const result = await api.pluginAction(installFolder, button.dataset.pluginAction, $("actionCallsign").value);
      setStatus(result.message, 'success');
    } catch (error) { setStatus(error.message, 'error'); }
    finally { button.disabled = false; }
  });
});

let activePdcTemplate = $('pdcTemplateBridge');
for (const id of ['pdcTemplateBridge','pdcTemplateHoppie']) $(id).addEventListener('focus',()=>{activePdcTemplate=$(id);});
for (const variable of window.pdcTemplates.variables) {
  const button=document.createElement('button'); button.type='button'; button.textContent='{'+variable+'}';
  button.addEventListener('click',()=>{activePdcTemplate.setRangeText(button.textContent,activePdcTemplate.selectionStart,activePdcTemplate.selectionEnd,'end');activePdcTemplate.focus();});
  $('pdcTemplateVariables').appendChild(button);
}
$('resetPdcTemplatesBtn').addEventListener('click',()=>{ $('pdcTemplateBridge').value=window.pdcTemplates.defaults.bridge;$('pdcTemplateHoppie').value=window.pdcTemplates.defaults.hoppie; });
