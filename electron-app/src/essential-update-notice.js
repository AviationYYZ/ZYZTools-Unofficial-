async function showEssentialUpdateNotice(BrowserWindow, parent, appName) {
  const notice = new BrowserWindow({
    width: 440, height: 210, resizable: false, minimizable: false,
    maximizable: false, closable: false, autoHideMenuBar: true,
    parent: parent || undefined, modal: !!parent, show: false,
    title: appName + ' — Essential update',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  await notice.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(
    '<!doctype html><html><body style="margin:28px;background:#101316;color:#eef4f7;font:16px system-ui">' +
    '<h2 style="font-size:20px">Installing essential update…</h2>' +
    '<p>Downloading the latest required fixes. Please wait.</p>' +
    '<p style="color:#b8c6ce">The app will close while the update installs. Your settings are preserved.</p></body></html>'
  ));
  notice.show();
  const shownAt = Date.now();
  return {
    beforeInstall: async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, 2500 - (Date.now() - shownAt))));
    },
    close: () => { if (!notice.isDestroyed()) notice.destroy(); }
  };
}
module.exports = { showEssentialUpdateNotice };
