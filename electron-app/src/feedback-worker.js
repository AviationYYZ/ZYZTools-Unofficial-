const { parentPort, workerData } = require('node:worker_threads');
const job=workerData.action==='import'
  ? require('./euroscope-log-import').importLog(workerData.file,workerData.folder,workerData.date)
  : workerData.input?.narrative
    ? require('./flight-narrative').generate(workerData.folder,workerData.id,workerData.input)
    : require('./pilot-feedback').generate(workerData.folder, workerData.id, workerData.input);
job
  .then(result => parentPort.postMessage({ result }))
  .catch(error => parentPort.postMessage({ error: error.message }));
