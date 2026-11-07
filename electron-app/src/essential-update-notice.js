async function showEssentialUpdateNotice(BrowserWindow, parent, appName) {
  const notice = new BrowserWindow({
    width: 440, height: 300, resizable: false, minimizable: false,
    maximizable: false, closable: false, autoHideMenuBar: true,
    parent: parent || undefined, modal: !!parent, show: false,
    title: appName + ' — Essential update',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await notice.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<!doctype html><html><body style="margin:28px;background:#101316;color:#eef4f7;font:16px system-ui">' +
    '<h2 style="font-size:20px;text-align:center">Installing essential update…</h2>' +
    '<div id="ring" style="--p:0%;margin:auto;width:64px;height:64px;border-radius:50%;background:conic-gradient(#67dbce var(--p),#293941 0);mask:radial-gradient(transparent 56%,black 58%)"></div>' +
    '<p id="percent" style="text-align:center;font-variant-numeric:tabular-nums">0%</p>' +
    '<p style="color:#b8c6ce;text-align:center">The app will close while the update installs, then reopen. Your settings are preserved.</p></body></html>'
  ));
  notice.show();
  const shownAt = Date.now();
  return {
    progress: percent => {
      if (notice.isDestroyed()) return;
      const n = Math.max(0, Math.min(100, Math.round(percent)));
      if (Number.isFinite(n)) notice.webContents.executeJavaScript(`document.getElementById('ring').style.setProperty('--p','${n}%');document.getElementById('percent').textContent='${n}%';`).catch(() => {});
    },
    beforeInstall: async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 2500 - (Date.now() - shownAt))));
    },
    close: () => { if (!notice.isDestroyed()) notice.destroy(); }
  };
}
module.exports = { showEssentialUpdateNotice };
