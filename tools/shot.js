// Screenshot any screen in headless Edge / Chrome: boots the page (?debug), runs a setup script that may drive window.game,
// waits, then writes a PNG. For reviewing screens that have no review sheet (menus, the map, new arenas).
// Usage: node tools/shot.js out.png "<setup js>" [wait_ms=800] [WxH=1920x1080]
'use strict';
const fs = require('fs'), path = require('path');
const { serve, launch } = require('./browser');

(async () => {
  const [out, setup = '', wait = '800', size = '1920x1080'] = process.argv.slice(2);
  if (!out) { console.log('usage: node tools/shot.js out.png "<setup js>" [wait_ms] [WxH]'); process.exit(2); }
  const [w, h] = size.split('x').map(Number), srv = await serve(path.join(__dirname, '..')), br = await launch();
  await br.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await br.send('Runtime.enable');
  await br.page(`http://127.0.0.1:${srv.port}/index.html?debug`, "window.game && document.getElementById('playLbl').textContent === 'Play'");
  const r = await br.eval(`(async () => { ${setup}; return 'ok' })()`);
  await new Promise(res => setTimeout(res, +wait));
  fs.writeFileSync(out, Buffer.from((await br.send('Page.captureScreenshot', { format: 'png' })).data, 'base64'));
  const errs = br.events.filter(e => e.method === 'Runtime.exceptionThrown').map(e => e.params.exceptionDetails.exception && e.params.exceptionDetails.exception.description || e.params.exceptionDetails.text);
  await br.close(); srv.close();
  console.log(r, '→', out, errs.length ? '\nerrors:\n' + errs.join('\n') : '');
})();
