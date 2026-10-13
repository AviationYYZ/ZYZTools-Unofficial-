(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ZyzCustomTheme = factory();
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const defaults = { background: '#111827', header: '#172033', navigation: '#172033', panel: '#1f2937', text: '#f3f4f6', muted: '#b8c4d4', accent: '#4f8ac9', title: '#ffffff', font: 'Segoe UI', layout: 'top', titleSize: 28, radius: 6, titleCase: 'normal' };
  const fonts = ['Segoe UI', 'Arial', 'Consolas', 'Georgia', 'Trebuchet MS', 'Century Gothic'];
  function normalize(value) {
    const result = { ...defaults }; const raw = value && typeof value === 'object' ? value : {};
    for (const key of ['background', 'header', 'navigation', 'panel', 'text', 'muted', 'accent', 'title']) {
      if (/^#[0-9a-f]{6}$/i.test(raw[key])) result[key] = raw[key].toLowerCase();
    }
    if (fonts.includes(raw.font)) result.font = raw.font;
    if (['top', 'sidebar'].includes(raw.layout)) result.layout = raw.layout;
    if (['normal', 'uppercase'].includes(raw.titleCase)) result.titleCase = raw.titleCase;
    for (const [key, min, max] of [['titleSize', 18, 44], ['radius', 0, 16]]) {
      if (Number.isFinite(Number(raw[key]))) result[key] = Math.max(min, Math.min(max, Math.round(Number(raw[key]))));
    }
    return result;
  }
  function variables(value) {
    const t = normalize(value);
    return { '--bg': t.background, '--header': t.header, '--nav': t.navigation, '--panel': t.panel, '--panel-alt': t.panel,
      '--text': t.text, '--muted': t.muted, '--accent': t.accent, '--accent-2': t.accent, '--button': t.panel, '--button-hover': t.navigation,
      '--input': t.background, '--input-line': t.muted, '--line': t.muted, '--focus': t.accent,
      '--font': `"${t.font}", sans-serif`, '--font-size': '14px', '--custom-title-color': t.title,
      '--custom-title-size': t.titleSize + 'px', '--custom-radius': t.radius + 'px', '--custom-title-case': t.titleCase === 'uppercase' ? 'uppercase' : 'none' };
  }
  return { defaults, fonts, normalize, variables };
});
