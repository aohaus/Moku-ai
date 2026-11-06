#!/usr/bin/env node
/**
 * Moku UX cycle log (CLAUDE.md §9).
 *
 * Every change made through the UX agents leaves a trail in the repo:
 *   ux-cycles/logs/<cycle>.jsonl   one JSON object per line, append-only
 *
 * Written automatically by Claude Code hooks (.claude/settings.json) when a
 * moku-detective / moku-fixer / moku-guardian subagent starts and finishes
 * (its final report, the commit, and the files changed so far), and by the
 * /ux-cycle Producer for the decisions people make.
 *
 *   node scripts/ux-agent-log.js hook                       # stdin = hook JSON (from settings.json)
 *   node scripts/ux-agent-log.js start <short-name>          # begin a cycle → prints the cycle id
 *   node scripts/ux-agent-log.js decision "<question>" "<chosen>" [who]
 *   node scripts/ux-agent-log.js note "<text>"
 *   node scripts/ux-agent-log.js end [PR url]
 *   node scripts/ux-agent-log.js render [cycle]             # Markdown summary (for the PR body)
 *
 * The current cycle id lives in .ux-cycle/current (gitignored). Without it the
 * log goes to ux-cycles/logs/<YYYY-MM-DD>.jsonl. The hook never fails the
 * agent: any error is swallowed and it always exits 0.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = process.env.CLAUDE_PROJECT_DIR || path.resolve(__dirname, '..');
const LOG_DIR = path.join(ROOT, 'ux-cycles', 'logs');
const CURRENT = path.join(ROOT, '.ux-cycle', 'current');
const MAX_TEXT = 20000; // keep one agent report readable in git

const today = () => new Date().toISOString().slice(0, 10);

function git(cmd) {
  try { return execSync('git ' + cmd, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { return ''; }
}

function currentCycle() {
  try { return fs.readFileSync(CURRENT, 'utf8').trim() || today(); } catch (e) { return today(); }
}

function append(entry, cycle) {
  const id = cycle || currentCycle();
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const row = Object.assign({ at: new Date().toISOString(), cycle: id, commit: git('rev-parse --short HEAD'), branch: git('rev-parse --abbrev-ref HEAD') }, entry);
  fs.appendFileSync(path.join(LOG_DIR, id + '.jsonl'), JSON.stringify(row) + '\n');
  return row;
}

function clip(text) {
  const s = String(text || '');
  return s.length > MAX_TEXT ? s.slice(0, MAX_TEXT) + '\n…(cut, ' + s.length + ' chars)' : s;
}

// Files changed in the working tree right now (what the agent left behind).
function changedFiles() {
  return git('status --porcelain -uall').split('\n').filter(Boolean)
    .map((l) => l.slice(3)).filter((f) => !f.startsWith('ux-cycles/logs/') && !f.startsWith('.ux-cycle/'));
}

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

function hook() {
  const input = JSON.parse(readStdin() || '{}');
  const agent = input.agent_type || '';
  if (!/^moku-(detective|fixer|guardian)$/.test(agent)) return;
  if (input.hook_event_name === 'SubagentStart') {
    append({ type: 'agent_start', agent, agentId: input.agent_id, session: input.session_id });
  } else if (input.hook_event_name === 'SubagentStop') {
    append({ type: 'agent_report', agent, agentId: input.agent_id, session: input.session_id, files: changedFiles(), report: clip(input.last_assistant_message) });
  }
}

function slug(s) {
  return String(s || 'cycle').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'cycle';
}

function load(cycle) {
  const file = path.join(LOG_DIR, cycle + '.jsonl');
  if (!fs.existsSync(file)) throw new Error('no log: ' + path.relative(ROOT, file));
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

const LABEL = { 'moku-detective': '🔍 Detective', 'moku-fixer': '🛠 Fixer', 'moku-guardian': '🌳 Guardian' };

function render(cycle) {
  const rows = load(cycle);
  const out = ['## UX サイクルのログ `' + cycle + '`', '', '`ux-cycles/logs/' + cycle + '.jsonl` の要約(時刻は UTC)。', ''];
  rows.forEach((r) => {
    const t = r.at.slice(11, 16);
    if (r.type === 'cycle_start') out.push('- ' + t + ' ▶ 開始(`' + r.commit + '` / `' + r.branch + '`)');
    else if (r.type === 'agent_start') out.push('- ' + t + ' ' + (LABEL[r.agent] || r.agent) + ' 開始');
    else if (r.type === 'agent_report') {
      out.push('- ' + t + ' ' + (LABEL[r.agent] || r.agent) + ' 完了' + (r.files.length ? '(変更中: ' + r.files.map((f) => '`' + f + '`').join(', ') + ')' : ''));
      out.push('', '  <details><summary>報告</summary>', '', r.report.split('\n').map((l) => '  ' + l).join('\n'), '', '  </details>', '');
    } else if (r.type === 'decision') out.push('- ' + t + ' 🙋 **' + r.question + '** → ' + r.chosen + (r.who ? '(' + r.who + ')' : ''));
    else if (r.type === 'note') out.push('- ' + t + ' 📝 ' + r.text);
    else if (r.type === 'cycle_end') out.push('- ' + t + ' ■ 終了' + (r.pr ? '(' + r.pr + ')' : ''));
  });
  return out.join('\n') + '\n';
}

function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (cmd === 'hook') {
    try { hook(); } catch (e) { /* never block the agent */ }
    return;
  }
  if (cmd === 'start') {
    const id = today() + '-' + slug(args[0]);
    fs.mkdirSync(path.dirname(CURRENT), { recursive: true });
    fs.writeFileSync(CURRENT, id + '\n');
    append({ type: 'cycle_start' }, id);
    console.log(id);
  } else if (cmd === 'decision') {
    if (!args[0] || !args[1]) throw new Error('usage: decision "<question>" "<chosen>" [who]');
    append({ type: 'decision', question: args[0], chosen: args[1], who: args[2] || '' });
  } else if (cmd === 'note') {
    append({ type: 'note', text: args.join(' ') });
  } else if (cmd === 'end') {
    append({ type: 'cycle_end', pr: args[0] || '' });
    try { fs.unlinkSync(CURRENT); } catch (e) { /* ignore */ }
  } else if (cmd === 'render') {
    process.stdout.write(render(args[0] || currentCycle()));
  } else {
    console.error('usage: ux-agent-log.js hook | start <name> | decision <q> <chosen> [who] | note <text> | end [pr] | render [cycle]');
    process.exit(2);
  }
}

main();
