// Facts transcribed from the user's ten simulation charts. No chart artwork is bundled.
// Effective 27 Nov 2025; not independently validated as current navigation data.
// Holding-box speeds are deliberately excluded: this simulator does not model holds.
const east=['05','06L','06R'],west=['23','24L','24R'],rules=[];
function add(procedure,runways,points,chart){for(const runway of runways)for(const [fix,kind,knots]of points)rules.push({airport:'CYYZ',procedure,runway,fix,kind,knots,aircraftCategory:'jet',source:'User-provided Jeppesen '+chart+', 21 Nov 2025 / effective 27 Nov 2025'});}
add('BOXUM7',east,[['DUVOS','at',250],['DEBGO','max',220],['MODOL','at',210]],'10-2');
add('BOXUM7',west,[['DUVOS','at',250],['ADSED','max',220],['TASKU','at',210]],'10-2A1');
add('IMEBA9',['05'],[['SEKOP','at',250],['PILPO','max',220],['MODOL','at',210]],'10-2C');
add('IMEBA9',['06L','06R'],[['SEKOP','at',250],['PEKMO','at',210]],'10-2C');
add('IMEBA9',west,[['LEPUX','at',220]],'10-2C2');
add('LINNG3',east,[['SEDAB','at',250],['SEGOD','at',210]],'10-2D');
add('LINNG3',west,[['YOUTH','at',250],['BIMPO','at',210]],'10-2D2');
add('NUBER6',east,[['IKBAT','at',220]],'10-2E3');
add('NUBER6',['23'],[['ROKTO','at',250],['MANUP','max',220],['TASKU','at',210]],'10-2E5');
add('NUBER6',['24L','24R'],[['ROKTO','at',250],['BOTUM','at',210]],'10-2E5');
add('RAGID6',['05'],[['LERAT','at',250],['KEVNO','at',210]],'10-2F');
add('RAGID6',['06L','06R'],[['LERAT','at',250],['RESES','at',210]],'10-2F');
add('RAGID6',west,[['DENKA','at',220]],'10-2F2');
module.exports={rules,notice:'User-provided jet STAR charts, effective 27 Nov 2025. Only 05/06L/06R and 23/24L/24R are covered. Holding speeds and 15/33-flow limits are not inferred. Not for navigation.'};
