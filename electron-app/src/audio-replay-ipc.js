const net = require('node:net');
const PIPE = require('./channel').channel.replayPipe;
let queue = Promise.resolve();
function exchange(command, connect = () => net.createConnection(PIPE)) {
  return new Promise((resolve, reject) => {
    let client, data = '', settled = false;
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const response = data.trim();
      client?.destroy();
      // Windows reports a normal server disconnect as EPIPE on some Node versions.
      // A received helper response is authoritative even when end never fires.
      if (/^(OK|ERROR)\|/.test(response)) {
        if (response.startsWith('ERROR|')) reject(new Error(response.slice(6)));
        else resolve(response);
      } else reject(error || new Error('The replay helper closed without a response. Try again.'));
    };
    const timer = setTimeout(() => finish(new Error('The replay helper did not respond in time.')), command === 'save' ? 15000 : 3500);
    try { client = connect(); } catch (error) { finish(error); return; }
    client.on('connect', () => client.write(command + '\n'));
    client.on('data', chunk => { data += chunk.toString('utf8'); });
    client.on('end', () => finish());
    client.on('close', () => finish());
    client.on('error', error => finish(new Error(
      data ? 'The replay helper connection closed.' :
        'The replay helper is unavailable. Enable replay in settings and save, then try again.'
    )));
  });
}
function sendAudioReplayCommand(command) {
  if (!['status', 'save', 'shutdown'].includes(command) && !/^intensity (100|[0-9]{1,2})$/.test(command)) return Promise.reject(new Error('Unknown replay action.'));
  const result = queue.then(() => exchange(command));
  queue = result.catch(() => {});
  return result;
}
module.exports = { sendAudioReplayCommand, exchange };
