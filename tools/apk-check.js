// node tools/apk-check.js [file.apk]  -> boots the page bundled in an APK the way the Android WebView loads it (from file://, no
// server, the app's user agent) in headless Chromium: the version, no console errors, the bundled fonts, a save that survives a
// reload, the in-app hints hidden, the shell's hooks present. The closest check this PC can make without a device; the result goes
// into docs/test-report.md. Exit code 1 on any failure.
'use strict';
const fs = require('fs'), os = require('os'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');
const { launch } = require('./browser');

// the assets/ entries of a zip (an APK is one): a minimal central-directory reader, stored or deflated entries only
function unzipAssets(buf, dir) {
  let e = buf.length - 22; while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--; if (e < 0) throw new Error('not a zip');
  let p = buf.readUInt32LE(e + 16); const n = buf.readUInt16LE(e + 10), out = [];
  for (let i = 0; i < n; i++, p += 46 + buf.readUInt16LE(p + 28) + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)) {
    const name = buf.toString('utf8', p + 46, p + 46 + buf.readUInt16LE(p + 28)), method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), at = buf.readUInt32LE(p + 42);
    if (!name.startsWith('assets/') || name.endsWith('/')) continue;
    const start = at + 30 + buf.readUInt16LE(at + 26) + buf.readUInt16LE(at + 28), raw = buf.subarray(start, start + size);
    const f = path.join(dir, name); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, method === 8 ? zlib.inflateRawSync(raw) : raw); out.push(name);
  }
  return out;
}

(async () => {
  const apk = path.resolve(process.argv[2] || path.join(__dirname, '..', 'Issen-FiveShadows-1.8.apk')), buf = fs.readFileSync(apk);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'issen-apk-')), files = unzipAssets(buf, dir), url = 'file:///' + path.join(dir, 'assets', 'index.html').replace(/\\/g, '/') + '?debug';
  const br = await launch(), checks = []; let ok = true;
  const check = (name, pass, detail = '') => { checks.push(`${pass ? 'pass' : 'FAIL'}  ${name}${detail ? ` (${detail})` : ''}`); if (!pass) ok = false; };
  try {
    await br.send('Runtime.enable'); await br.send('Log.enable'); await br.send('Network.enable');
    const ua = (await br.eval('navigator.userAgent')) + ' IssenApp'; await br.send('Network.setUserAgentOverride', { userAgent: ua });
    const ready = "window.game && document.getElementById('playLbl').textContent === 'Play'";
    await br.page(url, ready);
    check('boots from file:// with the app user agent', true, `${files.length} assets`);
    check('version', !!(await br.eval('game.VERSION')), 'v' + await br.eval('game.VERSION'));
    check('bundled fonts load', await br.eval(`document.fonts.ready.then(() => document.fonts.check('40px "Yuji Boku"', '一閃') && document.fonts.check('20px "Cormorant Garamond"'))`));
    check('in-app: the download and install hints are hidden', await br.eval(`[...document.querySelectorAll('a[href$=".apk"]')].every(a => !a.offsetParent)`));
    check('the shell hooks exist (pause, resume, back)', await br.eval(`['pause','resume','back'].every(k => typeof issenApp[k] === 'function')`));
    await br.eval(`(game.SV.profile.mon = 4321, game.writeSave(game.SV))`); await br.page(url, ready);
    check('a save written on file:// survives a reload', (await br.eval('game.SV.profile.mon')) === 4321);
    await new Promise(r => setTimeout(r, 400));
    const errs = br.events.filter(e => e.method === 'Runtime.exceptionThrown' || e.method === 'Runtime.consoleAPICalled' && e.params.type === 'error' || e.method === 'Log.entryAdded' && e.params.entry.level === 'error')
      .map(e => e.params.exceptionDetails ? e.params.exceptionDetails.text : e.params.entry ? `${e.params.entry.text} ${(e.params.entry.url || '').replace(/^.*\/assets\//, '')}` : e.params.args.map(a => a.value ?? a.description).join(' '))
      .filter(t => !/navigator\.vibrate|serviceWorker|service worker|tools\/poselab\.js/i.test(t)); // no service worker on file://; ?debug (used here to reach the game) also asks for the Pose Lab, which never ships
    check('no console errors', !errs.length, errs.slice(0, 3).join(' | '));
  } catch (e) { check('ran to the end', false, String(e && e.message || e)); }
  await br.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(`APK ${path.basename(apk)}  sha256 ${crypto.createHash('sha256').update(buf).digest('hex')}`); console.log(checks.map(c => '  ' + c).join('\n'));
  process.exit(ok ? 0 : 1);
})();
