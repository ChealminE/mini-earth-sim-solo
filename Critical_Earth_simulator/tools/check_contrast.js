// ============================================================================
// 디자인 토큰 대비 검사 (WCAG 2.x 상대 휘도) — css/theme.css 의 :root 값을 읽는다
// ----------------------------------------------------------------------------
// 글자색 × 바탕색 조합이 4.5:1(AA 본문) 이상인지 본다. 보조 글자(ink-3)도 같은 기준.
// 실행: node tools/check_contrast.js        (--md 를 붙이면 PR용 표를 마크다운으로 찍는다)
// ============================================================================
const fs = require('fs');
const path = require('path');
const css = fs.readFileSync(path.join(__dirname, '..', 'css', 'theme.css'), 'utf8');
const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
const tok = {};
for (const m of root.matchAll(/(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6})/g)) tok[m[1]] = m[2];

const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const lum = hex => { const n = parseInt(hex.slice(1), 16); return 0.2126 * lin(n >> 16) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// [글자, 바탕, 쓰임]
const pairs = [];
for (const fg of ['--ink', '--ink-2', '--ink-3']) for (const bg of ['--paper', '--paper-2', '--paper-3']) pairs.push([fg, bg, '본문·보조 글자']);
// 마우스 올림 바탕 = color-mix(in srgb, 영역색 16%, 옅은 바탕) (theme.css .btn:hover 와 같은 비율)
const HOVER_MIX = 0.16;
const mix = (a, b, w) => '#' + [16, 8, 0].map(s => Math.round(((parseInt(a.slice(1), 16) >> s) & 255) * w
  + ((parseInt(b.slice(1), 16) >> s) & 255) * (1 - w)).toString(16).padStart(2, '0')).join('');
for (const a of ['nav', 'time', 'scen', 'view', 'rec']) tok[`hover(${a})`] = mix(tok[`--ctl-${a}`], tok[`--ctl-${a}-bg`], HOVER_MIX);
for (const a of ['nav', 'time', 'scen', 'view', 'rec']) {
  pairs.push([`--ctl-${a}`, `--ctl-${a}-bg`, '버튼 기본(글자/바탕)']);
  pairs.push([`--ctl-${a}`, `hover(${a})`, '버튼 마우스 올림']);
  pairs.push([`--ctl-${a}`, '--paper', '버튼 글자/종이']);
  pairs.push(['--on-fill', `--ctl-${a}-on`, '눌린 버튼(흰 글자/채움)']);
}
for (const d of ['co2', 'temp', 'ph', 'sst', 'omega', 'obs', 'fossil', 'luc', 'ocean', 'land']) pairs.push([`--data-${d}`, '--paper', '데이터 레이블(굵게)/종이']);
for (const k of ['obs', 'model', 'param', 'assumption', 'calibrated']) pairs.push(['--on-fill', `--kind-${k}`, 'ⓘ 종류 배지']);
pairs.push(['--warn', '--warn-bg', 'ⓘ 미확인 경고']);
pairs.push(['--ctl-time', '--paper', 'ⓘ 링크']);
pairs.push(['--ir-ink', '--ir-bg', '적외선 보기 덮개 글자(3차 F)']);
// ── 1인칭 (4차 D1, 수용 조건 8) ──
// 3D 위 패널 = --paper-2 를 --fp-panel-mix 만큼 칠한 반투명. 뒤 장면이 가장 어두울 때(검정)와 가장 밝을 때(흰 하늘)를 섞어 만든다.
const panelMix = parseFloat((/--fp-panel-mix\s*:\s*([\d.]+)%/.exec(root) || [])[1]) / 100;
if (!(panelMix >= 0.94)) { console.log(`FAIL  --fp-panel-mix ${panelMix} < 0.94 (D §1: 패널 불투명도 0.94 이상)`); process.exitCode = 1; }
tok['fp패널(검은 장면 위)'] = mix(tok['--paper-2'], '#000000', panelMix);
tok['fp패널(흰 하늘 위)'] = mix(tok['--paper-2'], '#ffffff', panelMix);
for (const bg of ['fp패널(검은 장면 위)', 'fp패널(흰 하늘 위)']) {
  for (const fg of ['--ink', '--ink-2', '--ink-3']) pairs.push([fg, bg, '1인칭 패널 글자']);
  pairs.push(['--ctl-rec', bg, '1인칭 야장 제목 기록 수']);
  pairs.push(['--warn', bg, '1인칭 HUD 경고(산호)']);
}
// 완료한 과제 카드(--ctl-scen-bg) 위 글자, 과제 안내 상자
for (const fg of ['--ink', '--ink-2', '--ink-3']) pairs.push([fg, '--ctl-scen-bg', '1인칭 완료 과제 카드·안내']);
// 계측기 표시창(LCD) — 어두운 기기 화면 위 숫자·단위·상태 글자
for (const k of ['label', 'ok', 'busy', 'idle', 'err', 'co2', 'temp', 'ph', 'sea', 'alarm', 'caution']) pairs.push([`--lcd-${k}`, '--lcd-bg', '1인칭 계측기 표시창']);
// 자연 지구 회색은 선 색으로만 쓴다(글자에는 쓰지 않음) — 3:1(그래픽 요소 기준)만 본다
const graphic = [['--data-nature', '--paper', '자연 지구 선(그래픽, 3:1)']];

let fail = 0;
const md = process.argv.includes('--md');
if (md) console.log('| 글자 | 바탕 | 쓰임 | 대비 |\n|---|---|---|---|');
for (const [fg, bg, use] of pairs) {
  const r = ratio(tok[fg], tok[bg]); if (r < 4.5) fail++;
  console.log(md ? `| \`${fg}\` ${tok[fg]} | \`${bg}\` ${tok[bg]} | ${use} | **${r.toFixed(2)}**${r < 4.5 ? ' ✗' : ''} |`
                 : `${r >= 4.5 ? 'OK  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${fg} on ${bg}  (${use})`);
}
for (const [fg, bg, use] of graphic) {
  const r = ratio(tok[fg], tok[bg]); if (r < 3) fail++;
  console.log(md ? `| \`${fg}\` ${tok[fg]} | \`${bg}\` ${tok[bg]} | ${use} | **${r.toFixed(2)}** |`
                 : `${r >= 3 ? 'OK  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${fg} on ${bg}  (${use})`);
}
console.log(fail ? `\n실패 ${fail}건` : '\n전부 통과');
process.exit(fail || process.exitCode ? 1 : 0);
