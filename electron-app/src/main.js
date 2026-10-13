const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const crypto = require("crypto");
const childProcess = require("child_process");
const { sendPluginAction } = require("./plugin-actions");
const { sendAudioReplayCommand } = require("./audio-replay-ipc");
const updates = require("./github-updates");
const { publish: publishTest } = require("./test-publisher");
const publishingAuth = require('./publishing-auth');
const buildInfo = require("../package.json");
const { channel, destination, assertDestination } = require('./channel');
let publicationInProgress = false;
let checkedRelease = null;
const { app, BrowserWindow, dialog, ipcMain, shell, safeStorage } = require("electron");
app.setName(channel.name);
app.setPath('userData', path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), channel.userDataName));

let mainWindow = null;
const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
else app.on('second-instance', () => { mainWindow?.show(); mainWindow?.focus(); });

const FILES_TO_INSTALL = [
  { name: "PreferredCYYZPdcPlugin.dll", preserve: false },
  { name: "PreferredCYYZPdcBridge.exe", preserve: false },
  { name: "PreferredCYYZAudioReplay.exe", preserve: false },
  { name: "EuroScopePlugInDll.dll", preserve: false },
  { name: "PDCBridge.ini", preserve: true },
  { name: "pdc_request.wav", preserve: false },
  { name: "cpdlc_rx.wav", preserve: false },
  { name: "IFR_release.wav", preserve: false },
  { name: "DEPARTURE_LIST_SETUP.md", preserve: false },
  { name: "CHANGELOG.md", preserve: false },
  { name: "README.md", preserve: false }
];

const DEFAULT_CONFIG = {
  schema_version: 1,
  hoppie_enabled: 0,
  hoppie_logon_code: "REPLACE_WITH_YOUR_HOPPIE_LOGON_CODE",
  station_code: "CYYZ",
  poll_seconds: 60,
  airport_direction: "EAST",
  operation: "DUALS",
  runway_assignment_config: "off",
  ui_theme: "current",
  duals_mode: "off",
  confirm_every_pdc: 0,
  pdc_sound_enabled: 1,
  ifr_sound_enabled: 1,
  send_sound_enabled: 1,
  audio_replay_enabled: 1,
  audio_replay_seconds: 180,
  audio_replay_tx_radio_intensity: 70,
  audio_replay_capture_mode: "process",
  audio_replay_processes: "trackaudio.exe",
  audio_replay_folder: "Recordings",
  audio_replay_save_command: "replay save",
  trackaudio_version: "auto",
  test_mode: 0,
  debug_mode: 0,
  pdc_request_sound: "pdc_request.wav",
  ifr_release_sound: "IFR_release.wav",
  send_sound: "pdc_send.wav",
  settings_app_path: "",
  runway_assignments: {
    west: {
      "23": ["ANCOL", "ARROW", "AVSEP", "EBKIN", "PERLO", "GOPUP", "IKLEN", "KISEP", "LAKES", "MATES", "MIXUT", "NOSIK", "NUGOP", "PEMBA", "SEDOG", "TRNTO", "TULEK", "URSAL"],
      "24R": ["BETES", "BOMET", "DEDKI", "DUSOM", "KEPTA", "MAVAN", "OAKVL", "RIGUS", "TEVAD", "VERDO"]
    },
    east: {
      "05": ["ANCOL", "ARROW", "AVSEP", "EBKIN", "GOPUP", "IKLEN", "KISEP", "LAKES", "MATES", "NOSIK", "NUGOP", "PERLO", "SEDOG", "TRNTO", "TULEK", "URSAL"],
      "06L": ["BETES", "BOMET", "DEDKI", "DUSOM", "KEPTA", "MAVAN", "MIXUT", "OAKVL", "PEMBA", "RIGUS", "TEVAD", "VERDO"]
    }
  }
};

function roamingAppData() {
  return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
}

function localAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
}

function defaultParentFolder() {
  return path.join(roamingAppData(), "EuroScope");
}

function commandLinePluginFolder() {
  const args = process.argv.slice(1);
  for (let i = 0; i < args.length; ++i) {
    const arg = String(args[i] || "");
    const lower = arg.toLowerCase();
    if (lower === "--plugin-dir" || lower === "--install-folder") {
      const next = args[i + 1];
      return next ? String(next).trim() : "";
    }
    if (lower.startsWith("--plugin-dir=")) {
      return arg.slice("--plugin-dir=".length).trim();
    }
    if (lower.startsWith("--install-folder=")) {
      return arg.slice("--install-folder=".length).trim();
    }
  }
  return "";
}

function localSettingsFolder() {
  return path.join(roamingAppData(), channel.localSettingsName);
}

function localSettingsPath() {
  return path.join(localSettingsFolder(), "PreferredCYYZPdcPlugin.json");
}

function installDestination(selectedPath) {
  return destination(selectedPath, defaultParentFolder());
}

function discoveredInstalledPluginFolder() {
  const euroScopeRoot = defaultParentFolder();
  const candidates = [];
  const addCandidate = (folder, priority) => {
    if (!folder) return;
    const configPath = path.join(folder, "PreferredCYYZPdcPlugin.json");
    const dllPath = path.join(folder, "PreferredCYYZPdcPlugin.dll");
    if (!fs.existsSync(configPath) && !fs.existsSync(dllPath)) return;
    let mtime = 0;
    try {
      mtime = Math.max(
        fs.existsSync(configPath) ? fs.statSync(configPath).mtimeMs : 0,
        fs.existsSync(dllPath) ? fs.statSync(dllPath).mtimeMs : 0
      );
    } catch {
      mtime = 0;
    }
    candidates.push({ folder, priority, mtime });
  };

  try {
    for (const entry of fs.readdirSync(euroScopeRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      addCandidate(
        path.join(euroScopeRoot, entry.name, "plugins", channel.pluginFolderName),
        0
      );
    }
  } catch {
    // No EuroScope roaming folder yet; fall through to the default below.
  }

  addCandidate(path.join(euroScopeRoot, channel.pluginFolderName), 1);
  candidates.sort((a, b) => a.priority - b.priority || b.mtime - a.mtime);
  return candidates.length ? candidates[0].folder : "";
}

function payloadFolder() {
  return app.isPackaged
    ? path.join(process.resourcesPath, "plugin")
    : path.resolve(__dirname, "..", "..", "build");
}

function payloadFile(name) {
  return path.join(payloadFolder(), name);
}

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function loadPayloadDefaultConfig() {
  return readJsonIfExists(payloadFile("PreferredCYYZPdcPlugin.json")) || DEFAULT_CONFIG;
}

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim().toUpperCase())
      .filter(Boolean);
  }
  return String(value || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function normalizeReplayCommand(value) {
  let command = String(value || "").trim();
  while (command.startsWith(".")) command = command.slice(1).trim();
  command = command.replace(/\s+/g, " ");
  return command || "replay save";
}

function normalizeTheme(value) {
  const theme = String(value || "current").trim().toLowerCase();
  if (theme === "vatcan" || theme === "vatcansitu") return "vatcan";
  if (theme === "cpp" || theme === "plugincore" || theme === "plugin_core" || theme === "core") return "plugincore";
  return "current";
}

function normalizeTrackAudioSelection(value) {
  const selected = String(value || "auto").trim().toLowerCase();
  if (selected === "stable" || selected === "1.4.0" || selected === "trackaudio-stable") return "stable";
  if (
    selected === "legacy133" ||
    selected === "legacy" ||
    selected === "legacy-stable" ||
    selected === "stable133" ||
    selected === "1.3.3" ||
    selected === "trackaudio-legacy"
  ) return "legacy133";
  if (selected === "beta" || selected === "1.4.0-beta.6" || selected === "trackaudio-beta") return "beta";
  return "auto";
}

function clampInteger(value, min, max, fallback) {
  const numeric = Number.parseInt(value, 10);
  if (Number.isNaN(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function normalizeConfig(raw) {
  const base = structuredClone(DEFAULT_CONFIG);
  const payloadDefault = loadPayloadDefaultConfig();
  const merged = {
    ...base,
    ...payloadDefault,
    ...(raw || {}),
    runway_assignments: {
      west: {
        ...base.runway_assignments.west,
        ...(payloadDefault.runway_assignments && payloadDefault.runway_assignments.west),
        ...(raw && raw.runway_assignments && raw.runway_assignments.west)
      },
      east: {
        ...base.runway_assignments.east,
        ...(payloadDefault.runway_assignments && payloadDefault.runway_assignments.east),
        ...(raw && raw.runway_assignments && raw.runway_assignments.east)
      }
    }
  };

  merged.station_code = String(merged.station_code || "CYYZ").trim().toUpperCase();
  merged.poll_seconds = clampInteger(merged.poll_seconds, 45, 75, 60);
  merged.audio_replay_seconds = clampInteger(merged.audio_replay_seconds, 60, 600, 180);
  merged.audio_replay_tx_radio_intensity = clampInteger(merged.audio_replay_tx_radio_intensity, 0, 100, 70);
  merged.audio_replay_capture_mode = "process";
  merged.audio_replay_processes = String(merged.audio_replay_processes || "trackaudio.exe").trim() || "trackaudio.exe";
  merged.audio_replay_folder = String(merged.audio_replay_folder || "Recordings").trim() || "Recordings";
  merged.audio_replay_save_command = normalizeReplayCommand(merged.audio_replay_save_command);
  merged.trackaudio_version = normalizeTrackAudioSelection(merged.trackaudio_version);
  merged.airport_direction = String(merged.airport_direction || "WEST").trim().toUpperCase();
  merged.operation = String(merged.operation || "DUALS").trim().toUpperCase();
  merged.ui_theme = normalizeTheme(merged.ui_theme);
  merged.runway_assignment_config = ["east", "west"].includes(merged.runway_assignment_config)
    ? merged.runway_assignment_config : "off";
  if (merged.runway_assignment_config !== "off") {
    merged.airport_direction = merged.runway_assignment_config.toUpperCase();
    merged.operation = "DUALS";
  }
  merged.duals_mode = merged.runway_assignment_config === "east" ? "05"
    : merged.runway_assignment_config === "west" ? "23" : "off";
  delete merged.no_non_conforming_departures;
  merged.runway_assignments.west["23"] = normalizeList(merged.runway_assignments.west["23"]);
  merged.runway_assignments.west["24R"] = normalizeList(merged.runway_assignments.west["24R"]);
  merged.runway_assignments.east["05"] = normalizeList(merged.runway_assignments.east["05"]);
  merged.runway_assignments.east["06L"] = normalizeList(merged.runway_assignments.east["06L"]);
  return merged;
}

function configPathForInstall(installFolder) {
  return path.join(installFolder, "PreferredCYYZPdcPlugin.json");
}

function loadConfig(installFolder) {
  const installed = readJsonIfExists(configPathForInstall(installFolder));
  assertDestination(installFolder, installed);
  if (installed) return normalizeConfig(installed);
  const local = readJsonIfExists(localSettingsPath());
  if (local) return normalizeConfig(local);
  return normalizeConfig(loadPayloadDefaultConfig());
}

function saveLocalConfig(config) {
  fs.mkdirSync(localSettingsFolder(), { recursive: true });
  fs.writeFileSync(localSettingsPath(), JSON.stringify(normalizeConfig(config), null, 2), "utf8");
}

function saveInstalledConfig(installFolder, config) {
  assertDestination(installFolder, readJsonIfExists(configPathForInstall(installFolder)));
  fs.mkdirSync(installFolder, { recursive: true });
  const target = configPathForInstall(installFolder);
  fs.writeFileSync(target + ".tmp", JSON.stringify({ ...normalizeConfig(config), build_channel: channel.test ? 'test' : 'production' }, null, 2), "utf8");
  fs.renameSync(target + ".tmp", target);
}

function appExecutablePath() {
  return process.execPath;
}

function getInitialState() {
  const launchFolder = commandLinePluginFolder();
  const discoveredFolder = launchFolder ? "" : discoveredInstalledPluginFolder();
  const initialFolder = launchFolder || discoveredFolder || defaultParentFolder();
  const installFolder = installDestination(initialFolder);
  const startupConfig = normalizeConfig({ ...loadConfig(installFolder), runway_assignment_config: "off" });
  if (fs.existsSync(configPathForInstall(installFolder))) saveInstalledConfig(installFolder, startupConfig);
  saveLocalConfig(startupConfig);
  return {
    isTestBuild: buildInfo.zyzBuildChannel === 'test',
    appDisplayName: channel.name,
    pluginFolderName: channel.pluginFolderName,
    appVersion: buildInfo.version,
    defaultParentFolder: installFolder,
    localSettingsFolder: localSettingsFolder(),
    installFolder,
    payloadFolder: payloadFolder(),
    appPath: appExecutablePath(),
    installed: fs.existsSync(path.join(installFolder, "PreferredCYYZPdcPlugin.dll")),
    config: startupConfig
  };
}

function backupFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  const backup = `${filePath}.backup-${stamp}`;
  fs.copyFileSync(filePath, backup);
  return backup;
}

function copyPayloadFile(name, destinationFolder, preserve) {
  const source = payloadFile(name);
  if (!fs.existsSync(source)) throw new Error(`Missing packaged plugin payload: ${name}`);
  const target = path.join(destinationFolder, name);
  if (preserve && fs.existsSync(target)) return { name, preserved: true };
  fs.copyFileSync(source, target);
  return { name, preserved: false };
}

function processIsRunning(exeName) {
  const processName = String(exeName || "").replace(/\.exe$/i, "");
  if (!processName) return false;
  try {
    const command = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `$p = Get-Process -Name ${JSON.stringify(processName)} -ErrorAction SilentlyContinue; if ($p) { 'RUNNING' }`
    ];
    const output = childProcess.execFileSync("powershell.exe", command, {
      windowsHide: true,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    if (output.toUpperCase().includes("RUNNING")) return true;
  } catch {
    // Fall back to tasklist below.
  }

  try {
    const output = childProcess.execFileSync("tasklist.exe", ["/FI", `IMAGENAME eq ${exeName}`], {
      windowsHide: true,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    return output.toLowerCase().includes(exeName.toLowerCase());
  } catch {
    return false;
  }
}

function fileVersion(filePath) {
  try {
    const command = [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      `[Diagnostics.FileVersionInfo]::GetVersionInfo(${JSON.stringify(filePath)}).FileVersion`
    ];
    return childProcess.execFileSync("powershell.exe", command, {
      windowsHide: true,
      encoding: "utf8"
    }).trim();
  } catch {
    return "";
  }
}

const TRACK_AUDIO_TAPS = {
  stable: {
    label: "stable 1.4.0",
    version: "1.4.0",
    packagedFile: "TrackAudioTap-1.4.0-afv_native.dll",
    devPath: ["build", "TrackAudioTap140", "out", "afv_native.dll"]
  },
  legacy133: {
    label: "legacy stable 1.3.3",
    version: "1.3.3",
    packagedFile: "TrackAudioTap-1.3.3-afv_native.dll",
    devPath: ["build", "TrackAudioTapStable", "out", "afv_native.dll"]
  },
  beta: {
    label: "beta 1.4.0-beta.6",
    version: "1.4.0-beta.6",
    packagedFile: "TrackAudioTap-1.4.0-beta.6-afv_native.dll",
    devPath: ["build", "TrackAudioTap", "out", "afv_native.dll"]
  }
};

function tapKeyForInstalledVersion(version) {
  const normalized = String(version || "").trim();
  for (const [key, tap] of Object.entries(TRACK_AUDIO_TAPS)) {
    if (tap.version === normalized) return key;
  }
  return null;
}

function supportedTrackAudioVersionsText() {
  return "TrackAudio stable 1.4.0, legacy stable 1.3.3, or beta 1.4.0-beta.6";
}

function trackAudioTapSourceForKey(key) {
  const tap = TRACK_AUDIO_TAPS[key];
  if (!tap) return null;
  return app.isPackaged
    ? path.join(payloadFolder(), tap.packagedFile)
    : path.resolve(__dirname, "..", "..", ...tap.devPath);
}

function sha256File(filePath) {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").toUpperCase();
  } catch {
    return "";
  }
}

function trackAudioRoot() {
  return path.join(localAppData(), "Programs", "trackaudio");
}

function trackAudioModuleTargets(root) {
  return [
    path.join(
      root,
      "resources",
      "app.asar.unpacked",
      "node_modules",
      "trackaudio-afv",
      "build",
      "Release",
      "afv_native.dll"
    ),
    path.join(root, "afv_native.dll")
  ].filter((target, index, self) => self.indexOf(target) === index);
}

function inspectTrackAudioTap(selection = "auto") {
  const selected = normalizeTrackAudioSelection(selection);
  const root = trackAudioRoot();
  const executable = path.join(root, "trackaudio.exe");
  const installed = fs.existsSync(executable);
  const installedVersion = installed ? fileVersion(executable) : "";
  const detectedKey = tapKeyForInstalledVersion(installedVersion);
  const selectedKey = selected === "auto" ? detectedKey : selected;
  const selectedTap = selectedKey ? TRACK_AUDIO_TAPS[selectedKey] : null;
  const source = selectedKey ? trackAudioTapSourceForKey(selectedKey) : null;
  const sourceExists = !!source && fs.existsSync(source);
  const sourceHash = sourceExists ? sha256File(source) : "";
  const running = processIsRunning("trackaudio.exe");
  const targets = installed
    ? trackAudioModuleTargets(root).map((target) => {
        const exists = fs.existsSync(target);
        const hash = exists ? sha256File(target) : "";
        return {
          path: target,
          exists,
          patched: !!sourceHash && exists && hash === sourceHash,
          hash
        };
      })
    : [];
  const existingTargets = targets.filter((target) => target.exists);

  let supported = installed && !!selectedTap && sourceExists;
  let message = "";
  if (!installed) {
    supported = false;
    message = `TrackAudio is not installed in Local AppData. Install ${supportedTrackAudioVersionsText()} first.`;
  } else if (!detectedKey) {
    supported = false;
    message = `TrackAudio ${installedVersion || "unknown"} is installed, but this replay tap currently supports ${supportedTrackAudioVersionsText()}.`;
  } else if (selected !== "auto" && selectedTap && selectedTap.version !== installedVersion) {
    supported = false;
    message = `Settings selected TrackAudio ${selectedTap.label} (${selectedTap.version}), but installed TrackAudio is ${installedVersion}. Change the selection or install that TrackAudio version.`;
  } else if (!sourceExists) {
    supported = false;
    message = `The packaged ${selectedTap.label} TrackAudio tap is missing. Rebuild or reinstall this settings app.`;
  } else if (existingTargets.length === 0) {
    message = `TrackAudio ${installedVersion} is installed but its native audio module is missing. Click Apply or Repair to recreate it.`;
  } else if (existingTargets.every((target) => target.patched)) {
    message = `TrackAudio ${installedVersion} ${selectedTap.label} tap is installed. Replay can capture processed controller TX.`;
  } else if (running) {
    message = `TrackAudio ${installedVersion} is running. Close TrackAudio before applying or repairing the tap.`;
  } else {
    message = `TrackAudio ${installedVersion} ${selectedTap.label} tap needs to be applied or repaired. This usually happens after reinstalling TrackAudio.`;
  }

  return {
    installed,
    installedVersion,
    selected,
    selectedKey,
    supported,
    running,
    source,
    sourceExists,
    sourceHash,
    targets,
    ready: supported && existingTargets.length > 0 && existingTargets.every((target) => target.patched),
    message
  };
}

function installTrackAudioTap(selection = "auto") {
  const status = inspectTrackAudioTap(selection);
  if (!status.supported || status.running) return status.message;

  const backups = [];
  let installed = 0;
  for (const tapTarget of status.targets) {
    try {
      fs.mkdirSync(path.dirname(tapTarget.path), { recursive: true });
      const backup = backupFile(tapTarget.path);
      fs.copyFileSync(status.source, tapTarget.path);
      ++installed;
      if (backup) backups.push(path.basename(backup));
    } catch (error) {
      console.warn(`Failed to install TrackAudio tap to ${tapTarget.path}:`, error?.message || error);
    }
  }

  if (installed === 0) {
    return `TrackAudio ${status.installedVersion} tap could not be applied. Close TrackAudio and try Apply / repair TrackAudio tap again.`;
  }
  return `TrackAudio ${status.installedVersion} private processed-TX tap installed to ${installed} native module file(s)${backups.length ? `; backups created: ${backups.length}` : ""}.`;
}

function installEuroScopePayload(parentFolder, config) {
  const destination = installDestination(parentFolder);
  fs.mkdirSync(destination, { recursive: true });

  const copied = FILES_TO_INSTALL.map((file) => copyPayloadFile(file.name, destination, file.preserve));
  const merged = normalizeConfig({
    ...loadConfig(destination),
    ...config,
    settings_app_path: appExecutablePath()
  });
  saveInstalledConfig(destination, merged);

  const tapStatus = channel.test ? 'Test plugin installed separately. TrackAudio repair is available only through its explicit button.' : installTrackAudioTap(merged.trackaudio_version);
  return {
    destination,
    copied,
    tapStatus,
    config: merged
  };
}

function recordingsFolder(installFolder, config) {
  const folder = String(config.audio_replay_folder || "Recordings");
  if (/^[A-Za-z]:[\\/]/.test(folder) || folder.startsWith("\\\\")) return folder;
  return path.join(installFolder, folder);
}

function listRecordings(installFolder, config) {
  const folder = recordingsFolder(installFolder, config);
  if (!fs.existsSync(folder)) return { folder, files: [] };
  const files = fs.readdirSync(folder)
    .filter((name) => name.toLowerCase().endsWith(".wav"))
    .map((name) => {
      const filePath = path.join(folder, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        path: filePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  return { folder, files };
}

function statisticsFolder(installFolder) {
  return path.join(installFolder, "Statistics");
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseWorksheetRows(xml, worksheetName) {
  const rows = [];
  const worksheetRegex = /<Worksheet\b([^>]*)>([\s\S]*?)<\/Worksheet>/g;
  let worksheetMatch = null;
  while ((worksheetMatch = worksheetRegex.exec(xml))) {
    const attributes = worksheetMatch[1] || "";
    const nameMatch = attributes.match(/\bss:Name="([^"]*)"/) || attributes.match(/\bName="([^"]*)"/);
    const name = decodeXml(nameMatch && nameMatch[1]);
    if (name !== worksheetName) continue;

    const worksheetXml = worksheetMatch[2] || "";
    const rowRegex = /<Row\b[^>]*>([\s\S]*?)<\/Row>/g;
    let rowMatch = null;
    while ((rowMatch = rowRegex.exec(worksheetXml))) {
      const values = [];
      const cellRegex = /<Cell\b[^>]*>\s*<Data\b[^>]*>([\s\S]*?)<\/Data>\s*<\/Cell>/g;
      let cellMatch = null;
      while ((cellMatch = cellRegex.exec(rowMatch[1] || ""))) {
        values.push(decodeXml(cellMatch[1]).trim());
      }
      if (values.length) rows.push(values);
    }
    break;
  }
  return rows;
}

function rowsToObjects(rows) {
  if (!rows || rows.length < 2) return [];
  const headers = rows[0].map((header) => String(header || "").trim());
  return rows.slice(1).map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row[index] || "";
    });
    return item;
  });
}

function parseStatisticsSpreadsheet(filePath) {
  const xml = fs.readFileSync(filePath, "utf8");
  const summaryRows = parseWorksheetRows(xml, "Summary");
  const summary = {};
  for (const row of summaryRows.slice(1)) {
    if (row[0]) summary[row[0]] = row[1] || "";
  }

  const numericSummaryKeys = [
    "Aircraft cleared",
    "Aircraft departed",
    "Aircraft landed",
    "Total movements",
    "Session hours",
    "Average movements per hour"
  ];
  for (const key of numericSummaryKeys) {
    if (Object.prototype.hasOwnProperty.call(summary, key)) {
      const parsed = Number.parseFloat(summary[key]);
      summary[key] = Number.isFinite(parsed) ? parsed : 0;
    }
  }

  return {
    summary,
    events: rowsToObjects(parseWorksheetRows(xml, "Movements")),
    trafficVolume: rowsToObjects(parseWorksheetRows(xml, "Traffic Volume"))
  };
}

function listStatistics(installFolder) {
  const folder = statisticsFolder(installFolder);
  if (!fs.existsSync(folder)) {
    return { folder, files: [], latest: null };
  }

  const files = fs.readdirSync(folder)
    .filter((name) => /^CYYZ_Statistics_.*\.xml$/i.test(name) || name.toLowerCase().endsWith(".xml"))
    .map((name) => {
      const filePath = path.join(folder, name);
      const stat = fs.statSync(filePath);
      return {
        name,
        path: filePath,
        size: stat.size,
        mtimeMs: stat.mtimeMs
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  let latest = null;
  if (files[0]) {
    try {
      latest = {
        ...files[0],
        ...parseStatisticsSpreadsheet(files[0].path)
      };
    } catch (error) {
      latest = {
        ...files[0],
        summary: {},
        events: [],
        trafficVolume: [],
        parseError: error.message
      };
    }
  }

  return { folder, files, latest };
}

async function saveLatestStatistics(installFolder) {
  const stats = listStatistics(installFolder);
  if (!stats.latest) {
    throw new Error("No statistics spreadsheet has been exported yet. Connect to the network in EuroScope or use .STATS EXPORT first.");
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Save latest CYYZ statistics spreadsheet",
    defaultPath: path.join(os.homedir(), "Downloads", stats.latest.name),
    filters: [
      { name: "Excel XML spreadsheet", extensions: ["xml"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (result.canceled || !result.filePath) return { canceled: true };
  fs.copyFileSync(stats.latest.path, result.filePath);
  return { canceled: false, path: result.filePath };
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 940,
    height: 720,
    minWidth: 780,
    minHeight: 590,
    autoHideMenuBar: true,
    backgroundColor: "#101316",
    title: buildInfo.displayName || 'ZYZTools test',
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const updatePreferencesPath = () => path.join(app.getPath('userData'), 'update-stream.json');
function selectedUpdateStream() {
  try { return JSON.parse(fs.readFileSync(updatePreferencesPath(), 'utf8')).stream === 'beta' ? 'beta' : 'stable'; }
  catch { return 'stable'; }
}
app.whenReady().then(async () => {
  if (!ownsInstance) return;
  createWindow();
  // The development app must never replace itself with the consumer installer.
  if (channel.test) return;
  try {
    const release = await updates.check(updates.DEFAULT_REPOSITORY, app.getVersion(), undefined, selectedUpdateStream());
    if (release.available && release.essential) {
      const installer = await updates.download(release, path.join(app.getPath('temp'), channel.userDataName + '-Updates'));
      const child = childProcess.spawn(installer, ['/S'], { detached: true, stdio: 'ignore', windowsHide: true });
      child.on('error', error => { if (mainWindow) dialog.showErrorBox('Essential update could not start', error.message); });
      child.once('spawn', () => { child.unref(); app.quit(); });
    }
  } catch (error) { console.warn('Startup update check:', error.message); }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.handle("app:initialState", async () => getInitialState());
ipcMain.handle("test:tokenSettings", async () => shell.openExternal('https://github.com/settings/personal-access-tokens/new'));
ipcMain.handle("test:publish", async (_event, options = {}) => {
  if (!channel.test) throw new Error("Beta publishing is available only in ZYZTools test.");
  if (publicationInProgress) throw new Error("A beta publication is already running.");
  let token = String(options.token || "").trim() || publishingAuth.load(app.getPath("userData"), safeStorage);
  if (!token) return { needsAuth: true };
  if (options.remember && !safeStorage?.isEncryptionAvailable()) throw new Error("Secure storage is unavailable. Leave Remember access unchecked.");
  publicationInProgress = true;
  try {
    const installer = app.isPackaged ? path.join(process.resourcesPath, 'Publishing/ZYZTools-Setup.exe') : path.join(__dirname, '../../installer/dist/production/ZYZTools-Setup.exe');
    if (!fs.existsSync(installer)) throw new Error('Bundled publishing installer is missing. Reinstall the current test build.');
    const sourcePath = app.isPackaged ? path.join(process.resourcesPath, "TestSourceSnapshot.json") : path.join(__dirname, "../../build/TestSourceSnapshot.json");
    const snapshot = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    const result = await publishTest({ token, version: app.getVersion(), installer, snapshot, stream: options.stream, essential: options.essential === true });
    if (options.remember) {
      try { publishingAuth.save(app.getPath("userData"), token, safeStorage); }
      catch { result.authWarning = "Beta published, but GitHub access could not be remembered."; }
    }
    return result;
  } finally { token = null; publicationInProgress = false; }
});
ipcMain.handle("updates:check", async (_event, stream) => {
  stream = stream === 'beta' ? 'beta' : stream === 'stable' ? 'stable' : selectedUpdateStream();
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(updatePreferencesPath(), JSON.stringify({ stream }));
  checkedRelease = null;
  checkedRelease = await updates.check(updates.DEFAULT_REPOSITORY, app.getVersion(), undefined, stream);
  if (channel.test) return { available: false, message: checkedRelease.message + ' Developer app stays separate; publishing includes the consumer installer.' };
  return { tag: checkedRelease.tag, available: checkedRelease.available, message: checkedRelease.message, currentVersionPublished: checkedRelease.currentVersionPublished };
});
ipcMain.handle("updates:install", async () => {
  const installer = await updates.download(checkedRelease, path.join(app.getPath('temp'), channel.userDataName + '-Updates'));
  const error = await shell.openPath(installer);
  if (error) throw new Error(error);
  app.quit();
});
ipcMain.handle("plugin:action", async (_event, folder, action, callsign) => {
  loadConfig(folder);
  return sendPluginAction(folder, action, callsign);
});

ipcMain.handle("folder:browseParent", async (_event, currentPath) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Choose the EuroScope parent folder",
    defaultPath: currentPath || defaultParentFolder(),
    properties: ["openDirectory", "createDirectory"]
  });
  if (result.canceled || !result.filePaths[0]) return { canceled: true };
  return {
    canceled: false,
    parentFolder: result.filePaths[0],
    installFolder: installDestination(result.filePaths[0])
  };
});

ipcMain.handle("config:load", async (_event, installFolder) => loadConfig(installFolder));

ipcMain.handle("config:saveLocal", async (_event, config) => {
  const normalized = normalizeConfig(config);
  saveLocalConfig(normalized);
  return normalized;
});

ipcMain.handle("config:saveInstalled", async (_event, installFolder, config) => {
  const previous = loadConfig(installFolder);
  const normalized = normalizeConfig({
    ...config,
    settings_app_path: appExecutablePath()
  });
  saveInstalledConfig(installFolder, normalized);

  // If the user saved an installed config that toggles audio replay, try to
  // bring the replay helper in line with the saved setting so changes take
  // effect immediately from the settings app.
  try {
    const helperPath = path.join(installFolder, "PreferredCYYZAudioReplay.exe");
    const replayRuntimeChanged =
      Number(previous.audio_replay_enabled) !== Number(normalized.audio_replay_enabled) ||
      previous.audio_replay_seconds !== normalized.audio_replay_seconds ||
      previous.audio_replay_capture_mode !== normalized.audio_replay_capture_mode ||
      previous.audio_replay_processes !== normalized.audio_replay_processes ||
      previous.audio_replay_folder !== normalized.audio_replay_folder;

    const startHelper = async () => {
      if (fs.existsSync(helperPath)) {
        const args = [
          "--seconds", String(Math.max(30, Math.min(normalized.audio_replay_seconds, 600))),
          "--tx-radio-intensity", String(Math.max(0, Math.min(normalized.audio_replay_tx_radio_intensity ?? 70, 100))),
          "--mode", normalized.audio_replay_capture_mode || "process",
          "--processes", normalized.audio_replay_processes || "trackaudio.exe",
          "--output", recordingsFolder(installFolder, normalized)
        ];
        const child = childProcess.spawn(helperPath, args, {
          detached: true,
          stdio: "ignore",
          windowsHide: true
        });
        child.unref();
      }
    };

    const helperStatusMatchesConfig = (status) =>
      String(status || "").includes(`window ${Math.max(30, Math.min(normalized.audio_replay_seconds, 600))} sec`) &&
      String(status || "").includes(`controller radio ${Math.max(0, Math.min(normalized.audio_replay_tx_radio_intensity ?? 70, 100))}%`);

    const restartHelper = async () => {
      try {
        await sendAudioReplayCommand("shutdown");
        await new Promise((resolve) => setTimeout(resolve, 250));
      } catch {
        // Not running or not responding; the next start attempt is enough.
      }
      await startHelper();
    };

    if (normalized.audio_replay_enabled) {
      if (replayRuntimeChanged) {
        await restartHelper();
      } else {
        try {
          const status = await sendAudioReplayCommand("status");
          if (!helperStatusMatchesConfig(status)) {
            if (status.includes(`window ${normalized.audio_replay_seconds} sec`))
              await sendAudioReplayCommand(`intensity ${normalized.audio_replay_tx_radio_intensity}`);
            else await restartHelper();
          }
        } catch {
          await startHelper();
        }
      }
    } else {
      // Try to shut down a running helper if present.
      try {
        await sendAudioReplayCommand("shutdown");
      } catch {
        // If the helper isn't responding, best-effort: ignore.
      }
    }
  } catch (e) {
    throw new Error(`Settings saved, but replay could not apply them: ${e.message}. Install/update the EuroScope plugin payload and try again.`);
  }

  return normalized;
});

ipcMain.handle("plugin:install", async (_event, parentFolder, config) => installEuroScopePayload(parentFolder, config));

ipcMain.handle("trackAudio:status", async (_event, selection) => inspectTrackAudioTap(selection));

ipcMain.handle("trackAudio:applyTap", async (_event, selection) => {
  const applyMessage = installTrackAudioTap(selection);
  return {
    ...inspectTrackAudioTap(selection),
    applyMessage
  };
});

ipcMain.handle("folder:open", async (_event, folder) => {
  if (!folder) return false;
  fs.mkdirSync(folder, { recursive: true });
  await shell.openPath(folder);
  return true;
});

ipcMain.handle("recordings:list", async (_event, installFolder, config) => listRecordings(installFolder, normalizeConfig(config)));

ipcMain.handle("recordings:play", async (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) throw new Error("Recording file is missing.");
  await shell.openPath(filePath);
  return true;
});

ipcMain.handle("statistics:list", async (_event, installFolder) => listStatistics(installFolder));

ipcMain.handle("statistics:open", async (_event, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) throw new Error("Statistics spreadsheet is missing.");
  await shell.openPath(filePath);
  return true;
});

ipcMain.handle("statistics:saveLatest", async (_event, installFolder) => saveLatestStatistics(installFolder));

ipcMain.handle("audioReplay:command", async (_event, command) => sendAudioReplayCommand(command));
