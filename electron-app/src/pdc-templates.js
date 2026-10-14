(function(root) {
  const defaults = {"bridge":"TIMESTAMP {timestamp} *PRE-DEPARTURE CLEARANCE* FLT {callsign} {departure} {aircraft_type} FILED {altitude} XPRD {squawk} USE SID {sid} DEPARTURE RUNWAY {runway} DESTINATION {destination} *** ADVISE ATC IF RUNUP REQUIRED *** CONTACT ATC WITH IDENTIFIER {identifier} {sid}/{runway} {route}// FILED ROUTE END","hoppie":"TIMESTAMP {timestamp}\n*PRE-DEPARTURE CLEARANCE*\nFLT {callsign} {departure}\n{aircraft_type} FILED {altitude}\nXPRD {squawk}\nUSE SID {sid}\nDEPARTURE RUNWAY {runway}\nDESTINATION {destination}\n*** ADVISE ATC IF RUNUP REQUIRED ***\nCONTACT ATC WITH IDENTIFIER {identifier}\n{sid}/{runway}\n{route}\n// FILED ROUTE END"};
  const variables = ['timestamp','callsign','departure','destination','aircraft_type','altitude','squawk','sid','runway','identifier','route'];
  function validate(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2000 || /[^\x20-\x7e\n]/.test(value)) throw new Error('Templates must contain 1–2000 printable English characters (line breaks allowed).');
    const remainder = value.replace(/\{([a-z_]+)\}/g, (token,key) => {
      if (!variables.includes(key)) throw new Error('Unknown PDC variable: '+token);
      return '';
    });
    if (/[{}]/.test(remainder)) throw new Error('Use variables in {name} format.');
    if (!value.includes('{identifier}')) throw new Error('Keep {identifier} so pilots can acknowledge their clearance.');
    return value;
  }
  const api = {defaults,variables,validate};
  if (typeof module !== 'undefined') module.exports = api;
  else root.pdcTemplates = api;
})(typeof window !== 'undefined' ? window : globalThis);
