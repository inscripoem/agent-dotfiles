'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'sync-agent-config.js');
const mod = require('./sync-agent-config.js');
const {
  TARGETS, START_MARKER, END_MARKER,
  expandHome, isSymlink, resolveTarget, wrapContent, locateBlock,
  syncFile, removeBlock, blockState, parseAgentIds, resolveTargets, parseArgs,
} = mod;

const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'AGENTS.template.md'), 'utf8');

function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-dotfiles-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

// Run the CLI with HOME pointed at a temp dir so expandHome/os.homedir()
// resolve inside the sandbox instead of the real home directory.
function runCli(home, args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], {
    encoding: 'utf8',
    env: { ...process.env, HOME: home },
  });
}

function countMarkers(content) {
  return content.split(START_MARKER).length - 1;
}

describe('expandHome', () => {
  test('expands ~/ to the real home directory', () => {
    assert.equal(expandHome('~/.claude/CLAUDE.md'), path.join(os.homedir(), '.claude/CLAUDE.md'));
  });

  test('leaves absolute paths untouched', () => {
    assert.equal(expandHome('/etc/config'), '/etc/config');
  });
});

describe('isSymlink', () => {
  test('detects a valid symlink', (t) => {
    const dir = tmpDir(t);
    fs.writeFileSync(path.join(dir, 'real.md'), 'x');
    fs.symlinkSync('real.md', path.join(dir, 'link.md'));
    assert.equal(isSymlink(path.join(dir, 'link.md')), true);
  });

  test('detects a dangling symlink (target does not exist)', (t) => {
    const dir = tmpDir(t);
    fs.symlinkSync('missing.md', path.join(dir, 'dangling.md'));
    assert.equal(isSymlink(path.join(dir, 'dangling.md')), true);
  });

  test('returns false for regular and missing files', (t) => {
    const dir = tmpDir(t);
    fs.writeFileSync(path.join(dir, 'regular.md'), 'x');
    assert.equal(isSymlink(path.join(dir, 'regular.md')), false);
    assert.equal(isSymlink(path.join(dir, 'nope.md')), false);
  });
});

describe('resolveTarget', () => {
  test('resolves a valid symlink to its destination', (t) => {
    const dir = tmpDir(t);
    fs.writeFileSync(path.join(dir, 'real.md'), 'x');
    fs.symlinkSync('real.md', path.join(dir, 'link.md'));
    assert.equal(resolveTarget(path.join(dir, 'link.md')), path.join(dir, 'real.md'));
  });

  test('resolves a dangling symlink to its destination path', (t) => {
    const dir = tmpDir(t);
    fs.symlinkSync('missing.md', path.join(dir, 'dangling.md'));
    assert.equal(resolveTarget(path.join(dir, 'dangling.md')), path.join(dir, 'missing.md'));
  });

  test('returns the path itself for regular files', (t) => {
    const dir = tmpDir(t);
    fs.writeFileSync(path.join(dir, 'real.md'), 'x');
    assert.equal(resolveTarget(path.join(dir, 'real.md')), path.join(dir, 'real.md'));
  });
});

describe('locateBlock', () => {
  test('classifies absent, present, and broken marker layouts', () => {
    assert.equal(locateBlock('no markers').status, 'absent');
    assert.equal(locateBlock(`${START_MARKER}\nbody\n${END_MARKER}`).status, 'present');
    assert.equal(locateBlock(`${END_MARKER}\n${START_MARKER}`).status, 'broken');
    assert.equal(locateBlock(`${START_MARKER}\nno end`).status, 'broken');
    assert.equal(locateBlock(`no start\n${END_MARKER}`).status, 'broken');
  });
});

describe('syncFile', () => {
  test('creates the file with the wrapped template', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    assert.equal(syncFile(file, TEMPLATE), 'created');
    assert.equal(fs.readFileSync(file, 'utf8'), wrapContent(TEMPLATE) + '\n');
  });

  test('updates in place and preserves surrounding content', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    syncFile(file, 'old template');
    fs.writeFileSync(file, 'MY RULES\n\n' + fs.readFileSync(file, 'utf8') + '\nTAIL\n', 'utf8');
    assert.equal(syncFile(file, TEMPLATE), 'updated');
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.startsWith('MY RULES\n'));
    assert.ok(content.includes(wrapContent(TEMPLATE)));
    assert.ok(content.endsWith('TAIL\n'));
    assert.equal(countMarkers(content), 1);
  });

  test('appends when the file has no managed block', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, 'CUSTOM CONTENT\n', 'utf8');
    assert.equal(syncFile(file, TEMPLATE), 'appended');
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.startsWith('CUSTOM CONTENT\n'));
    assert.equal(countMarkers(content), 1);
  });

  test('dry run reports the action but writes nothing', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    assert.equal(syncFile(file, TEMPLATE, { dryRun: true }), 'created');
    assert.equal(fs.existsSync(file), false);

    syncFile(file, 'OLD-CONTENT');
    assert.equal(syncFile(file, TEMPLATE, { dryRun: true }), 'updated');
    assert.ok(fs.readFileSync(file, 'utf8').includes('OLD-CONTENT'));
  });

  test('refuses to touch a file with orphaned markers', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, `${START_MARKER}\nbroken`, 'utf8');
    assert.throws(() => syncFile(file, TEMPLATE), /Orphaned/);
    assert.equal(fs.readFileSync(file, 'utf8'), `${START_MARKER}\nbroken`);
  });
});

describe('removeBlock', () => {
  test('removes the block and keeps other content', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, 'HEAD\n' + wrapContent(TEMPLATE) + '\nTAIL\n', 'utf8');
    const result = removeBlock(file);
    assert.equal(result.action, 'removed');
    assert.equal(fs.readFileSync(file, 'utf8'), 'HEAD\n\nTAIL\n');
  });

  test('clears the file when only the block remains', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, wrapContent(TEMPLATE) + '\n', 'utf8');
    assert.equal(removeBlock(file).action, 'cleared');
    assert.equal(fs.readFileSync(file, 'utf8'), '');
  });

  test('reports missing files and files without blocks', (t) => {
    const dir = tmpDir(t);
    assert.equal(removeBlock(path.join(dir, 'nope.md')).action, 'missing');
    const file = path.join(dir, 'plain.md');
    fs.writeFileSync(file, 'custom only\n', 'utf8');
    assert.equal(removeBlock(file).action, 'none');
    assert.equal(fs.readFileSync(file, 'utf8'), 'custom only\n');
  });

  test('dry run leaves the file untouched', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, wrapContent(TEMPLATE), 'utf8');
    const result = removeBlock(file, { dryRun: true });
    assert.equal(result.action, 'cleared');
    assert.ok(fs.readFileSync(file, 'utf8').includes(START_MARKER));
  });

  test('throws on orphaned markers instead of corrupting the file', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, `x\n${END_MARKER}`, 'utf8');
    assert.throws(() => removeBlock(file), /Orphaned/);
  });
});

describe('blockState', () => {
  test('reports in-sync, stale, no-block, missing, and broken', (t) => {
    const dir = tmpDir(t);
    assert.equal(blockState(path.join(dir, 'nope.md'), TEMPLATE).state, 'missing');

    const synced = path.join(dir, 'synced.md');
    fs.writeFileSync(synced, wrapContent(TEMPLATE) + '\n', 'utf8');
    assert.equal(blockState(synced, TEMPLATE).state, 'in-sync');

    const stale = path.join(dir, 'stale.md');
    fs.writeFileSync(stale, wrapContent('old template'), 'utf8');
    assert.equal(blockState(stale, TEMPLATE).state, 'stale');

    const plain = path.join(dir, 'plain.md');
    fs.writeFileSync(plain, 'custom only\n', 'utf8');
    assert.equal(blockState(plain, TEMPLATE).state, 'no-block');

    const broken = path.join(dir, 'broken.md');
    fs.writeFileSync(broken, START_MARKER, 'utf8');
    assert.equal(blockState(broken, TEMPLATE).state, 'broken');
  });

  test('flags symlinked targets via lstat, including dangling links', (t) => {
    const dir = tmpDir(t);
    fs.writeFileSync(path.join(dir, 'real.md'), wrapContent(TEMPLATE) + '\n', 'utf8');
    fs.symlinkSync('real.md', path.join(dir, 'link.md'));
    fs.symlinkSync('missing.md', path.join(dir, 'dangling.md'));

    assert.equal(blockState(path.join(dir, 'link.md'), TEMPLATE).linked, true);
    assert.equal(blockState(path.join(dir, 'link.md'), TEMPLATE).state, 'in-sync');
    assert.equal(blockState(path.join(dir, 'dangling.md'), TEMPLATE).state, 'symlink');
  });
});

describe('argument parsing', () => {
  test('parses agent lists in all supported forms', () => {
    assert.deepEqual(parseAgentIds('claude, codex'), ['claude', 'codex']);
    assert.equal(resolveTargets(parseAgentIds('all')).length, TARGETS.length);
    assert.deepEqual(
      resolveTargets(parseAgentIds('zcode')).map(t => t.id),
      ['zcode'],
    );
  });

  test('parses flags', () => {
    const opts = parseArgs(['--dry-run', '--agents=claude,zcode', '--follow-symlinks']);
    assert.equal(opts.dryRun, true);
    assert.equal(opts.follow, true);
    assert.equal(opts.agents, 'claude,zcode');

    const short = parseArgs(['-a', 'codex', '-d']);
    assert.equal(short.agents, 'codex');
    assert.equal(short.delete, true);
  });

  test('ZCode is a registered target pointing at ~/.zcode/AGENTS.md', () => {
    const zcode = TARGETS.find(t => t.id === 'zcode');
    assert.ok(zcode, 'zcode target missing');
    assert.equal(zcode.path, '~/.zcode/AGENTS.md');
  });
});

describe('CLI: sync', () => {
  test('syncs only the selected agents and leaves others untouched', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--agents', 'claude,codex']);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(fs.readFileSync(targetPathIn(home, 'claude'), 'utf8').includes(START_MARKER));
    assert.ok(fs.readFileSync(targetPathIn(home, 'codex'), 'utf8').includes(START_MARKER));
    assert.equal(fs.existsSync(targetPathIn(home, 'gemini')), false, 'unselected agent must not be created');
  });

  test('re-running updates in place without duplicating blocks', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude']);
    const second = runCli(home, ['--agents', 'claude']);
    assert.equal(second.status, 0, second.stderr);
    assert.ok(second.stdout.includes('updated'));

    const content = fs.readFileSync(targetPathIn(home, 'claude'), 'utf8');
    assert.equal(countMarkers(content), 1);
    assert.ok(content.includes(wrapContent(TEMPLATE)));
  });

  test('custom content around the block survives a sync', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude']);
    const file = targetPathIn(home, 'claude');
    fs.writeFileSync(file, 'MY CUSTOM RULES\n\n' + fs.readFileSync(file, 'utf8'), 'utf8');

    runCli(home, ['--agents', 'claude']);
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.startsWith('MY CUSTOM RULES\n'));
    assert.equal(countMarkers(content), 1);
  });

  test('--agents does not prune unselected agents unless --prune-unselected', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude,codex']);

    runCli(home, ['--agents', 'zcode']);
    assert.ok(fs.readFileSync(targetPathIn(home, 'claude'), 'utf8').includes(START_MARKER),
      'claude block must survive a zcode-only sync');
    assert.ok(fs.readFileSync(targetPathIn(home, 'zcode'), 'utf8').includes(START_MARKER));

    runCli(home, ['--agents', 'zcode', '--prune-unselected']);
    assert.equal(fs.readFileSync(targetPathIn(home, 'claude'), 'utf8').includes(START_MARKER), false,
      'claude block should be pruned with --prune-unselected');
    assert.ok(fs.readFileSync(targetPathIn(home, 'zcode'), 'utf8').includes(START_MARKER));
  });

  test('--dry-run writes nothing', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--dry-run', '--agents', 'gemini']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('dry run'));
    assert.equal(fs.existsSync(targetPathIn(home, 'gemini')), false);
  });
});

describe('CLI: symlinks', () => {
  test('skips symlinked targets by default without touching the linked file', (t) => {
    const home = tmpDir(t);
    const shared = path.join(home, 'shared.md');
    fs.writeFileSync(shared, 'USER CONTENT\n', 'utf8');
    linkTargetIn(home, 'claude', shared);

    const result = runCli(home, ['--agents', 'claude']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('Symlink skipped'));
    assert.equal(fs.readFileSync(shared, 'utf8'), 'USER CONTENT\n');
  });

  test('--follow-symlinks writes through links and deduplicates shared files', (t) => {
    const home = tmpDir(t);
    const shared = path.join(home, 'shared.md');
    fs.writeFileSync(shared, 'USER CONTENT\n', 'utf8');
    linkTargetIn(home, 'claude', shared);
    linkTargetIn(home, 'codex', shared);

    const result = runCli(home, ['--agents', 'claude,codex', '--follow-symlinks']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('Shared file with Claude Code'));

    const content = fs.readFileSync(shared, 'utf8');
    assert.ok(content.startsWith('USER CONTENT\n'));
    assert.equal(countMarkers(content), 1, 'shared file must contain exactly one block');
  });

  test('deleting through a shared file is refused unless all sharers are included', (t) => {
    const home = tmpDir(t);
    const shared = path.join(home, 'shared.md');
    fs.writeFileSync(shared, wrapContent(TEMPLATE), 'utf8');
    linkTargetIn(home, 'claude', shared);
    linkTargetIn(home, 'codex', shared);

    const refused = runCli(home, ['--delete', '--agents', 'claude', '--follow-symlinks']);
    assert.equal(refused.status, 0, refused.stderr);
    assert.ok(refused.stdout.includes('also serves Codex'));
    assert.ok(fs.readFileSync(shared, 'utf8').includes(START_MARKER));

    const removed = runCli(home, ['--delete', '--agents', 'claude,codex', '--follow-symlinks']);
    assert.equal(removed.status, 0, removed.stderr);
    assert.equal(fs.readFileSync(shared, 'utf8').includes(START_MARKER), false);
  });

  test('dangling symlinks are skipped by default and written through with --follow-symlinks', (t) => {
    const home = tmpDir(t);
    linkTargetIn(home, 'claude', 'missing.md');
    // The link is relative, so the dangling destination sits next to the link.
    const destination = path.join(home, '.claude', 'missing.md');

    const skipped = runCli(home, ['--agents', 'claude']);
    assert.ok(skipped.stdout.includes('Symlink skipped'));
    assert.equal(fs.existsSync(destination), false);

    const written = runCli(home, ['--agents', 'claude', '--follow-symlinks']);
    assert.equal(written.status, 0, written.stderr);
    assert.ok(fs.readFileSync(destination, 'utf8').includes(START_MARKER));
  });
});

describe('CLI: status and delete', () => {
  test('--status reports per-agent state', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude']);

    const result = runCli(home, ['--status']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('in-sync'), 'claude should be in sync');
    assert.ok(result.stdout.includes('missing'), 'gemini was never synced');

    const stale = targetPathIn(home, 'claude');
    fs.writeFileSync(stale, wrapContent('old template'), 'utf8');
    const after = runCli(home, ['--status']);
    assert.ok(after.stdout.includes('stale'));
  });

  test('--delete removes only the selected block and keeps custom content', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude,codex']);
    const claudeFile = targetPathIn(home, 'claude');
    fs.writeFileSync(claudeFile, 'KEEP ME\n' + fs.readFileSync(claudeFile, 'utf8'), 'utf8');

    const result = runCli(home, ['--delete', '--agents', 'claude']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(fs.readFileSync(claudeFile, 'utf8'), 'KEEP ME\n\n');
    assert.ok(fs.readFileSync(targetPathIn(home, 'codex'), 'utf8').includes(START_MARKER));
  });

  test('--dry-run --delete leaves the block in place', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude']);
    const result = runCli(home, ['--delete', '--dry-run', '--agents', 'claude']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('dry run'));
    assert.ok(fs.readFileSync(targetPathIn(home, 'claude'), 'utf8').includes(START_MARKER));
  });

  test('unknown agents and unknown flags exit with an error', (t) => {
    const home = tmpDir(t);
    assert.equal(runCli(home, ['--agents', 'nope']).status, 1);
    assert.equal(runCli(home, ['--wat']).status, 1);
    assert.equal(runCli(home, ['--status', '--delete']).status, 1);
  });
});

// Resolve an agent's target path inside a specific fake HOME (unit/e2e helper).
function targetPathIn(home, id) {
  const target = TARGETS.find(t => t.id === id);
  return path.join(home, target.path.slice(2));
}

// Symlink an agent's target path (creating its parent dir first) to dest.
function linkTargetIn(home, id, dest) {
  const target = targetPathIn(home, id);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.symlinkSync(dest, target);
}
