'use strict';
const token = location.hash.slice(1);
if (location.hash) history.replaceState(null, '', '/');
const roster = document.getElementById('roster');
const filter = document.getElementById('filter');
const connection = document.getElementById('connection');
const notice = document.getElementById('notice');
let rows = [], sending = false, previousView = '';
const headers = { Authorization: 'Bearer ' + token };

function add(parent, tag, value) {
  const element = document.createElement(tag);
  if (value != null) element.textContent = value;
  parent.append(element);
  return element;
}

function render() {
  const term = filter.value.trim().toUpperCase();
  const view = rows.filter(row => (row.callsign + ' ' + row.destination).includes(term));
  const signature = JSON.stringify([view, sending, term]);
  if (signature === previousView) return;
  previousView = signature;
  roster.replaceChildren();
  const sorted = [...view].sort((a, b) => a.callsign.localeCompare(b.callsign, 'en', { numeric: true }));
  for (const row of sorted) {
    const card = add(roster, 'article');
    const title = add(card, 'header');
    add(title, 'strong', row.callsign);
    add(title, 'span', row.destination + (row.runway ? ' · RWY ' + row.runway : ''));
    add(card, 'p', row.status + (row.route ? ' · ' + row.route : ''));
    const button = add(card, 'button', 'Request PDC');
    button.setAttribute('aria-label', 'Request PDC for ' + row.callsign);
    button.disabled = sending;
    button.addEventListener('click', () => requestPdc(row.callsign));
  }
  if (term && !view.length && rows.length) add(roster, 'p', 'No matching departures.');
}

async function requestPdc(callsign) {
  if (sending) return;
  sending = true;
  render();
  notice.textContent = 'Requesting PDC for ' + callsign + '…';
  try {
    const response = await fetch('/api/pdc/' + encodeURIComponent(callsign), {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
    });
    const result = await response.json();
    notice.textContent = result.message || result.error;
  } catch { notice.textContent = 'Connection lost. Check EuroScope before trying again.'; }
  finally { sending = false; render(); }
}

async function refresh() {
  let retry = true;
  try {
    if (!/^[\w-]{32}$/.test(token)) {
      connection.textContent = 'Scan the QR code in ZYZTools to pair.';
      retry = false;
      return;
    }
    const response = await fetch('/api/roster', { headers, cache: 'no-store' });
    const result = await response.json();
    rows = response.ok ? result.rows : [];
    retry = response.status !== 401 && response.status !== 410;
    connection.textContent = !response.ok ? result.error : !result.ready ? 'Waiting for the departure list in EuroScope…' :
      rows.length ? rows.length + (rows.length === 1 ? ' departure' : ' departures') : 'No departures in the EuroScope list.';
  } catch {
    rows = [];
    connection.textContent = 'Desktop connection lost. Check Wi-Fi and that sharing is still on.';
  } finally {
    render();
    if (retry) setTimeout(refresh, 3000);
  }
}
filter.addEventListener('input', render);
refresh();
