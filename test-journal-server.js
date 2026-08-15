// Small integration check: the dashboard server must answer an HTTP request.
const assert = require('assert');
const http = require('http');
const { spawn } = require('child_process');

const port = 20000 + Math.floor(Math.random() * 20000);
const child = spawn(process.execPath, ['melvor-report.js', 'journal-serve', '--port', String(port)], {
  cwd: __dirname,
  env: { ...process.env, MELVOR_CHARACTERS: 'TestChar' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let output = '';
const fail = error => { child.kill(); throw error; };
const timeout = setTimeout(() => fail(Error('journal dashboard did not start')), 5000);
child.stdout.on('data', chunk => {
  output += chunk;
  if (!output.includes('Journal dashboard:')) return;
  http.get(`http://127.0.0.1:${port}/`, response => {
    assert.ok([200, 404].includes(response.statusCode), `unexpected dashboard status ${response.statusCode}`);
    response.resume();
    response.on('end', () => { clearTimeout(timeout); child.kill(); });
  }).on('error', fail);
});
child.on('exit', code => {
  clearTimeout(timeout);
  assert.strictEqual(code, null, `journal dashboard exited unexpectedly: ${code}`);
  console.log('journal dashboard HTTP check ok');
});
