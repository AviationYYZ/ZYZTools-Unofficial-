(() => {
  const byId = id => document.getElementById('departureDesk' + id);
  const network = byId('Network'), start = byId('Start'), stop = byId('Stop');
  const canvas = byId('Qr'), status = byId('Status');
  const desk = (action, ip) => api.departureDesk(action, ip);
  let busy = false, issue = '';
  function render(state) {
    const selected = network.value;
    network.replaceChildren(...state.interfaces.map(n => new Option(n.name + ' · ' + n.ip, n.ip)));
    if (state.interfaces.some(n => n.ip === selected)) network.value = selected;
    start.disabled = busy || state.active || !network.value;
    stop.hidden = !state.active;
    stop.disabled = busy;
    network.disabled = busy || state.active;
    canvas.hidden = !state.qr;
    if (state.qr) {
      const { size, data } = state.qr;
      const scale = Math.floor(288 / (size + 8));
      canvas.width = canvas.height = (size + 8) * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#000';
      for (let i = 0; i < data.length; i++)
        if (data[i]) ctx.fillRect((4 + i % size) * scale, (4 + Math.floor(i / size)) * scale, scale, scale);
    } else canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    status.textContent = issue || (state.active
      ? 'Sharing until ' + new Date(state.expires).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + '. Treat this QR code like a password.'
      : network.value ? 'Not sharing. If your phone cannot open the page, check that both devices are on the same network and that Windows Firewall allows ZYZTools on private networks.'
        : 'No local network adapter found. Connect to your home Wi-Fi or Ethernet.');
  }
  async function refresh() { try { render(await desk('status')); } catch (e) { status.textContent = e.message; } }
  async function run(action) {
    if (busy) return;
    busy = true;
    issue = '';
    start.disabled = stop.disabled = true;
    try { await desk(action, network.value); }
    catch (e) { issue = e.message.replace(/^Error invoking remote method '[^']+': Error: /, ''); }
    finally { busy = false; await refresh(); }
  }
  start.addEventListener('click', () => run('start'));
  stop.addEventListener('click', () => run('stop'));
  refresh();
  setInterval(() => { if (!busy && byId('Card').getClientRects().length) refresh(); }, 3000);
})();
