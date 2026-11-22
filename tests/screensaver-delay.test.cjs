const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const script = fs.readFileSync(path.join(__dirname, '../assets/screensaver-delay.sh'), 'utf8');
// make_copy() alone, run against a fixture shaped like webOS 3.x's /etc/palm/nop-conf.json
const makeCopy = script.match(/^make_copy\(\) \{[\s\S]*?^\}$/m)[0];

const timer = (name, interval) => `{
    "name": "${name}",
    "timers": [
        {
            "name": "${name}",
            "interval": ${interval},
            "once": false
        }
    ]
}`;
const METHOD = `{
                "type": "method",
                "method": {
                    "method": "luna://com.webos.service.tv.systemproperty/getSystemInfo",
                    "payload": {"keys":["screenSaverTimeout"]},
                    "property": "screenSaverTimeout",
                    "type": "string"
                },
                "adjust": 0,
                "unit":"minute"
            }`;
const OTHER = `{
                "type": "constant",
                "constant": 2,
                "adjust": 0,
                "unit":"hour"
            }`;

function run(conf, minutes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aerial-delay-'));
  fs.writeFileSync(path.join(dir, 'conf.json'), conf);
  const r = spawnSync('sh', ['-c', `CONF="$1/conf.json"; COPY="$1/copy.json"\n${makeCopy}\nmake_copy "$2"`, 'sh', dir, String(minutes)]);
  const copy = fs.existsSync(path.join(dir, 'copy.json')) ? fs.readFileSync(path.join(dir, 'copy.json'), 'utf8') : '';
  return { status: r.status, copy };
}

test('replaces only the screensaver interval and keeps valid JSON', () => {
  const conf = `[${timer('[TIMER]autoPowerOff', OTHER)}, ${timer('[TIMER]ScreenSaver', METHOD)}]\n`;
  const { status, copy } = run(conf, 15);
  assert.strictEqual(status, 0);
  const parsed = JSON.parse(copy);
  assert.deepStrictEqual(parsed[1].timers[0].interval, { type: 'constant', constant: 15, adjust: 0, unit: 'minute' });
  assert.deepStrictEqual(parsed[0], JSON.parse(`[${timer('[TIMER]autoPowerOff', OTHER)}]`)[0]);
  assert.strictEqual(parsed[1].timers[0].once, false);
});

test('fails when the file has no screensaver timer', () => {
  const { status } = run(`[${timer('[TIMER]autoPowerOff', OTHER)}]\n`, 15);
  assert.notStrictEqual(status, 0);
});

test('the script parses', () => {
  execFileSync('sh', ['-n', path.join(__dirname, '../assets/screensaver-delay.sh')]);
});
