const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const mainRequire = require('node:module').createRequire(path.join(__dirname, 'src/main.js'));
const source = fs.readFileSync(path.join(__dirname, 'src/main.js'), 'utf8');
// Evaluate actual configuration code without starting Electron or touching installed settings.
const context = vm.createContext({
  structuredClone, require: name => name === 'electron' ? { app: { getVersion() {return '0.0.0';}, getPath() {return require('node:os').tmpdir();}, setName() {}, setPath() {}, requestSingleInstanceLock() { return true; }, on() {}, quit() {} } } : mainRequire(name),
  process, __dirname: path.join(__dirname, 'src')
});
vm.runInContext(source.slice(0, source.indexOf('function loadConfig(')) +
  '\nloadPayloadDefaultConfig = () => ({}); globalThis.normalize = normalizeConfig;', context);
for (const mode of [undefined, 'off', 'east', 'west', 'invalid']) {
  const result = context.normalize({ runway_assignment_config: mode, airport_direction: 'NORTH', operation: 'SINGLE 33L' });
  assert.equal(result.runway_assignment_config, ['east', 'west'].includes(mode) ? mode : 'off');
  assert.equal(result.duals_mode, mode === 'east' ? '05' : mode === 'west' ? '23' : 'off');
  if (mode === 'east' || mode === 'west') {
    assert.equal(result.airport_direction, mode.toUpperCase());
    assert.equal(result.operation, 'DUALS');
  }
  assert.equal(context.normalize(JSON.parse(JSON.stringify(result))).runway_assignment_config, result.runway_assignment_config);
}
const custom = context.normalize({ runway_assignment_config: 'west', runway_assignments: { west: { '23': ['ANCOL', 'MIXUT'] } } });
let switched = custom;
for (const mode of ['east', 'west', 'off', 'east']) {
  switched = context.normalize({ ...switched, runway_assignment_config: mode, duals_mode: '23' });
  assert.equal(switched.duals_mode, mode === 'east' ? '05' : mode === 'west' ? '23' : 'off');
}
assert.equal(custom.runway_assignments.west['23'].join(','), 'ANCOL,MIXUT');
const native = fs.readFileSync(path.join(__dirname, '../src/ZYZToolsPlugin.cpp'), 'utf8');
const sends = [...native.matchAll(/SendHoppie\([^\n]+/g)].filter(match =>
  !match[0].includes('const std::string') && !match[0].includes('"SERVER"'));
assert(sends.length >= 3);
assert(sends.every(match => match[0].includes('"telex"')), 'Every Hoppie send call must use TELEX');
assert(!native.includes('"/data2/" + GenerateHoppieMessageId()'), 'No CPDLC envelope on PDCs');
console.log('PASS: default-off, east/west selection, invalid input, persistence, custom matrix, TELEX send paths');
const startupFunction = source.slice(source.indexOf('function getInitialState('), source.indexOf('function backupFile('));
vm.runInContext(startupFunction + `
  commandLinePluginFolder = () => 'C:/test-plugin';
  installDestination = value => value;
  payloadFolder = () => 'C:/test-payload';
  appExecutablePath = () => 'C:/test-app.exe';
  const updatePreferencesPath = () => 'C:/test-plugin-test-only/update-stream.json';
  configPathForInstall = () => 'C:/test-plugin-test-only/plugin.json';
  loadCustomTheme = () => ({});
  loadConfig = () => normalizeConfig({runway_assignment_config:'west'});
  saveLocalConfig = value => { globalThis.startupSaved = value; };
  globalThis.startup = getInitialState();
`, context);
assert.equal(context.startup.config.runway_assignment_config, 'off');
assert.equal(context.startup.config.duals_mode, 'off');
assert.equal(context.startupSaved.runway_assignment_config, 'off');
assert.equal(context.startup.config.arrival_assignment_enabled, 0);
for (const flow of ['west', 'east', 'north', 'south']) {
  const value = vm.runInContext(`normalizeConfig({arrival_assignment_enabled:1,arrival_assignment_flow:'${flow}'})`, context);
  assert.equal(value.arrival_assignment_enabled, 1);
  assert.equal(value.arrival_assignment_flow, flow);
}
const badArrival = vm.runInContext("normalizeConfig({arrival_assignment_enabled:'invalid',arrival_assignment_flow:'invalid'})", context);
assert.equal(badArrival.arrival_assignment_enabled, 0);
assert.equal(badArrival.arrival_assignment_flow, 'west');
console.log('PASS: app startup resets a previously saved West selection to Off');
