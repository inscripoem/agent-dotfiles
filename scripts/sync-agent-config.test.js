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
  SKILLS_SOURCE_DIR, SKILLS_MANIFEST_NAME, SKILL_DESTINATIONS,
  expandHome, isSymlink, resolveTarget, wrapContent, locateBlock,
  syncFile, removeBlock, blockState,
  listSourceSkills, readManifest, writeManifest, hashDir,
  skillState, planSkillsSync, installSkill, resolveSkillDestinations,
  parseAgentIds, resolveTargets, parseArgs,
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

  test('compares CRLF blocks as in-sync (Windows autocrlf checkouts)', (t) => {
    const dir = tmpDir(t);
    const file = path.join(dir, 'CONFIG.md');
    fs.writeFileSync(file, wrapContent(TEMPLATE).replace(/\n/g, '\r\n'), 'utf8');
    assert.equal(blockState(file, TEMPLATE).state, 'in-sync');
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

  test('dsh is a registered target pointing at ~/.dsh/AGENTS.md', () => {
    const dsh = TARGETS.find(t => t.id === 'dsh');
    assert.ok(dsh, 'dsh target missing');
    assert.equal(dsh.path, '~/.dsh/AGENTS.md');
  });

  test('agy is a registered target sharing the Gemini CLI config file', () => {
    const agy = TARGETS.find(t => t.id === 'agy');
    assert.ok(agy, 'agy target missing');
    assert.equal(agy.path, '~/.gemini/GEMINI.md');
    const gemini = TARGETS.find(t => t.id === 'gemini');
    assert.equal(agy.path, gemini.path);
  });

  test('parses the --skills flag', () => {
    assert.equal(parseArgs(['--skills']).skills, true);
    assert.equal(parseArgs(['--skills', '--dry-run']).skills, true);
    assert.equal(parseArgs([]).skills, false);
  });

  test('parses the --instructions flag', () => {
    assert.equal(parseArgs(['--instructions']).instructions, true);
    assert.equal(parseArgs(['--instructions', '--skills']).instructions, true);
    assert.equal(parseArgs([]).instructions, false);
  });

  test('resolveSkillDestinations maps agent selections to destinations', () => {
    assert.equal(resolveSkillDestinations(['all']).length, SKILL_DESTINATIONS.length);
    assert.deepEqual(resolveSkillDestinations(['zcode']).map(d => d.id), ['shared']);
    assert.deepEqual(resolveSkillDestinations(['claude']).map(d => d.id), ['claude']);
    assert.deepEqual(resolveSkillDestinations(['gemini', 'agy']).map(d => d.id), ['shared', 'agy']);
    assert.deepEqual(resolveSkillDestinations(['claude', 'agy']).map(d => d.id), ['claude', 'agy']);
    assert.deepEqual(resolveSkillDestinations([]), []);
  });

  test('every instruction agent resolves to at least one skills destination', () => {
    for (const t of TARGETS) {
      assert.ok(
        resolveSkillDestinations([t.id]).length > 0,
        `${t.id} has no skills destination`,
      );
    }
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

  test('re-running sync reports in-sync without duplicating blocks', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'claude']);
    const second = runCli(home, ['--agents', 'claude']);
    assert.equal(second.status, 0, second.stderr);
    assert.ok(second.stdout.includes('in-sync'), 'unchanged blocks must report in-sync');
    assert.equal(second.stdout.includes('updated'), false, 'no write may happen for identical content');

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

  test('plain --agents syncs every kind for the selected agents', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--agents', 'gemini']);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(fs.readFileSync(targetPathIn(home, 'gemini'), 'utf8').includes(START_MARKER));
    assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'ro')), 'shared skills synced (gemini)');
    assert.equal(fs.existsSync(targetPathIn(home, 'claude')), false, 'unselected agent instructions untouched');
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills')), false, 'unselected agent skills untouched');
  });

  test('--instructions alone syncs instruction blocks everywhere and skips skills', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--instructions']);
    assert.equal(result.status, 0, result.stderr);

    for (const target of TARGETS) {
      assert.ok(
        fs.readFileSync(targetPathIn(home, target.id), 'utf8').includes(START_MARKER),
        `${target.id} instructions synced`,
      );
    }
    assert.equal(fs.existsSync(path.join(home, '.agents', 'skills')), false, 'no skills destination created');
  });

  test('--status covers every kind; kind flags narrow it', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'all']);

    const full = runCli(home, ['--status']);
    assert.equal(full.status, 0, full.stderr);
    assert.ok(full.stdout.includes('CLAUDE.md'), 'instruction section present');
    assert.ok(full.stdout.includes('└── ro'), 'skills section present');

    const instructionsOnly = runCli(home, ['--instructions', '--status']);
    assert.ok(instructionsOnly.stdout.includes('CLAUDE.md'));
    assert.equal(instructionsOnly.stdout.includes('└── ro'), false, 'skills section excluded');

    const skillsOnly = runCli(home, ['--skills', '--status']);
    assert.ok(skillsOnly.stdout.includes('└── ro'));
    assert.equal(skillsOnly.stdout.includes('CLAUDE.md'), false, 'instruction section excluded');
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
    assert.ok(result.stdout.includes('skipped (symlink)'));
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
    assert.ok(result.stdout.includes('updated (shared with Claude Code'));

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
    assert.ok(skipped.stdout.includes('skipped (symlink)'));
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

describe('skills: source listing and manifest', () => {
  test('listSourceSkills returns sorted names of folders containing SKILL.md', (t) => {
    const dir = tmpDir(t);
    fs.mkdirSync(path.join(dir, 'beta'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'beta', 'SKILL.md'), 'b');
    fs.mkdirSync(path.join(dir, 'alpha'));
    fs.writeFileSync(path.join(dir, 'alpha', 'SKILL.md'), 'a');
    fs.mkdirSync(path.join(dir, 'no-skill')); // folder without SKILL.md
    fs.mkdirSync(path.join(dir, '.hidden'), { recursive: true });
    fs.writeFileSync(path.join(dir, '.hidden', 'SKILL.md'), 'h'); // dot entry
    fs.writeFileSync(path.join(dir, 'plain.md'), 'x'); // file, not a folder
    assert.deepEqual(listSourceSkills(dir), ['alpha', 'beta']);
  });

  test('listSourceSkills tolerates a missing source directory', (t) => {
    assert.deepEqual(listSourceSkills(path.join(tmpDir(t), 'absent')), []);
  });

  test('manifest round-trips and tolerates missing or corrupt files', (t) => {
    const dir = tmpDir(t);
    assert.deepEqual(readManifest(dir), []);
    fs.writeFileSync(path.join(dir, SKILLS_MANIFEST_NAME), '{not json');
    assert.deepEqual(readManifest(dir), []);
    writeManifest(dir, ['ro']);
    assert.deepEqual(readManifest(dir), ['ro']);
  });
});

describe('skills: hashDir, skillState, plan, install', () => {
  function makeSkillSource(t, body) {
    const sourceDir = tmpDir(t);
    fs.mkdirSync(path.join(sourceDir, 'ro'));
    fs.writeFileSync(path.join(sourceDir, 'ro', 'SKILL.md'), body);
    return sourceDir;
  }

  test('hashDir changes when content or file layout changes', (t) => {
    const a = makeSkillSource(t, 'v1');
    const b = makeSkillSource(t, 'v1');
    assert.equal(hashDir(path.join(a, 'ro')), hashDir(path.join(b, 'ro')));

    fs.writeFileSync(path.join(a, 'ro', 'SKILL.md'), 'v2');
    assert.notEqual(hashDir(path.join(a, 'ro')), hashDir(path.join(b, 'ro')));

    fs.writeFileSync(path.join(a, 'ro', 'SKILL.md'), 'v1');
    fs.writeFileSync(path.join(a, 'ro', 'extra.txt'), 'x');
    assert.notEqual(hashDir(path.join(a, 'ro')), hashDir(path.join(b, 'ro')));
  });

  test('skillState classifies missing, in-sync, stale, foreign, and symlink', (t) => {
    const sourceDir = makeSkillSource(t, 'v1');
    const destDir = tmpDir(t);

    assert.equal(skillState(destDir, sourceDir, 'ro', ['ro']), 'missing');

    installSkill(sourceDir, 'ro', destDir);
    assert.equal(skillState(destDir, sourceDir, 'ro', ['ro']), 'in-sync');
    assert.equal(skillState(destDir, sourceDir, 'ro', []), 'foreign');

    fs.writeFileSync(path.join(destDir, 'ro', 'SKILL.md'), 'changed by hand');
    assert.equal(skillState(destDir, sourceDir, 'ro', ['ro']), 'stale');

    fs.symlinkSync(path.join(sourceDir, 'ro'), path.join(destDir, 'linked'));
    assert.equal(skillState(destDir, sourceDir, 'linked', ['linked']), 'symlink');
  });

  test('installSkill copies the whole folder; dry run writes nothing', (t) => {
    const sourceDir = tmpDir(t);
    const destDir = tmpDir(t);
    fs.mkdirSync(path.join(sourceDir, 'ro', 'references'), { recursive: true });
    fs.writeFileSync(path.join(sourceDir, 'ro', 'SKILL.md'), 'v1');
    fs.writeFileSync(path.join(sourceDir, 'ro', 'references', 'a.md'), 'ref');

    assert.equal(installSkill(sourceDir, 'ro', destDir, { dryRun: true }), 'created');
    assert.equal(fs.existsSync(path.join(destDir, 'ro')), false);

    assert.equal(installSkill(sourceDir, 'ro', destDir), 'created');
    assert.equal(fs.readFileSync(path.join(destDir, 'ro', 'references', 'a.md'), 'utf8'), 'ref');

    fs.writeFileSync(path.join(sourceDir, 'ro', 'SKILL.md'), 'v2');
    assert.equal(installSkill(sourceDir, 'ro', destDir), 'updated');
    assert.equal(fs.readFileSync(path.join(destDir, 'ro', 'SKILL.md'), 'utf8'), 'v2');
  });

  test('planSkillsSync proposes installs, skips foreign and symlinked, prunes removed', (t) => {
    const sourceDir = makeSkillSource(t, 'v1'); // source contains: ro
    fs.mkdirSync(path.join(sourceDir, 'new'));
    fs.writeFileSync(path.join(sourceDir, 'new', 'SKILL.md'), 'n');
    fs.mkdirSync(path.join(sourceDir, 'fresh'));
    fs.writeFileSync(path.join(sourceDir, 'fresh', 'SKILL.md'), 'f');
    fs.mkdirSync(path.join(sourceDir, 'stale-one'));
    fs.writeFileSync(path.join(sourceDir, 'stale-one', 'SKILL.md'), 'current');

    const destDir = tmpDir(t);
    fs.mkdirSync(path.join(destDir, 'ro'), { recursive: true }); // unmanaged collision
    fs.writeFileSync(path.join(destDir, 'ro', 'SKILL.md'), 'mine');
    fs.symlinkSync(path.join(sourceDir, 'new'), path.join(destDir, 'new')); // managed symlink
    fs.mkdirSync(path.join(destDir, 'stale-one'), { recursive: true }); // managed, modified
    fs.writeFileSync(path.join(destDir, 'stale-one', 'SKILL.md'), 'modified');
    fs.mkdirSync(path.join(destDir, 'old'), { recursive: true }); // managed, gone from source
    fs.writeFileSync(path.join(destDir, 'old', 'SKILL.md'), 'old');
    writeManifest(destDir, ['new', 'stale-one', 'old']);

    const plan = planSkillsSync(destDir, sourceDir, ['ro', 'new', 'fresh', 'stale-one']);
    assert.deepEqual(
      plan.install.map(i => `${i.name}:${i.action}`).sort(),
      ['fresh:created', 'stale-one:updated'],
    );
    assert.deepEqual(plan.skip, [
      { name: 'ro', reason: 'foreign' },
      { name: 'new', reason: 'symlink' },
    ]);
    assert.deepEqual(plan.prune, ['old']);
  });
});

describe('CLI: skills', () => {
  const REPO_SKILLS = listSourceSkills();

  test('the repository actually contains the ro skill used by these tests', () => {
    assert.ok(REPO_SKILLS.includes('ro'), 'skills/ro must exist for the e2e tests');
  });

  test('--skills installs every repo skill to all destinations with a manifest', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--skills']);
    assert.equal(result.status, 0, result.stderr);

    for (const dest of SKILL_DESTINATIONS) {
      const destDir = path.join(home, dest.path.slice(2));
      for (const name of REPO_SKILLS) {
        assert.equal(
          fs.readFileSync(path.join(destDir, name, 'SKILL.md'), 'utf8'),
          fs.readFileSync(path.join(SKILLS_SOURCE_DIR, name, 'SKILL.md'), 'utf8'),
          `${name} content must match in ${dest.path}`,
        );
      }
      assert.deepEqual(readManifest(destDir), REPO_SKILLS);
    }
  });

  test('re-running --skills reports in-sync and adds no duplicates', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--skills']);
    const second = runCli(home, ['--skills']);
    assert.equal(second.status, 0, second.stderr);
    assert.ok(second.stdout.includes('in-sync'));

    const destDir = path.join(home, SKILL_DESTINATIONS[0].path.slice(2));
    assert.deepEqual(
      fs.readdirSync(destDir).filter(n => !n.startsWith('.')),
      REPO_SKILLS,
    );
  });

  test('--skills --dry-run writes nothing', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--skills', '--dry-run']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('dry run'));
    assert.equal(fs.existsSync(path.join(home, SKILL_DESTINATIONS[0].path.slice(2))), false);
  });

  test('--skills leaves an unmanaged same-name skill untouched and never claims it', (t) => {
    const home = tmpDir(t);
    const shared = path.join(home, SKILL_DESTINATIONS[0].path.slice(2));
    fs.mkdirSync(path.join(shared, 'ro'), { recursive: true });
    fs.writeFileSync(path.join(shared, 'ro', 'SKILL.md'), 'mine');

    const result = runCli(home, ['--skills']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('foreign — not managed'));
    assert.equal(fs.readFileSync(path.join(shared, 'ro', 'SKILL.md'), 'utf8'), 'mine');
    assert.deepEqual(readManifest(shared), REPO_SKILLS.filter(n => n !== 'ro'));
  });

  test('--skills --delete removes managed skills but keeps foreign ones', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--skills']);
    const shared = path.join(home, SKILL_DESTINATIONS[0].path.slice(2));
    fs.mkdirSync(path.join(shared, 'user-own'), { recursive: true });
    fs.writeFileSync(path.join(shared, 'user-own', 'SKILL.md'), 'mine');

    const result = runCli(home, ['--skills', '--delete', '--agents', 'all']);
    assert.equal(result.status, 0, result.stderr);
    for (const name of REPO_SKILLS) {
      assert.equal(fs.existsSync(path.join(shared, name)), false, `${name} should be removed`);
    }
    assert.equal(fs.existsSync(path.join(shared, 'user-own')), true);
    assert.equal(fs.existsSync(path.join(shared, SKILLS_MANIFEST_NAME)), false);
  });

  test('--skills --status reports missing before sync and in-sync after', (t) => {
    const home = tmpDir(t);
    const before = runCli(home, ['--skills', '--status']);
    assert.equal(before.status, 0, before.stderr);
    assert.ok(before.stdout.includes('missing'));

    runCli(home, ['--skills']);
    const after = runCli(home, ['--skills', '--status']);
    assert.equal(after.status, 0, after.stderr);
    assert.ok(after.stdout.includes('in-sync'));
  });

  test('--skills --agents syncs only the destinations serving those agents', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--skills', '--agents', 'claude,zcode']);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(fs.existsSync(path.join(home, '.claude', 'skills', 'ro')), 'claude destination synced');
    assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'ro')), 'shared destination synced (zcode)');
    assert.equal(fs.existsSync(path.join(home, '.trae-cn', 'skills')), false, 'trae-cn untouched');
    assert.equal(fs.existsSync(path.join(home, '.gemini', 'antigravity-cli', 'skills')), false, 'agy untouched');
  });

  test('--skills --agents with --prune-unselected clears the other destinations', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--skills']);

    const result = runCli(home, ['--skills', '--agents', 'dsh', '--prune-unselected']);
    assert.equal(result.status, 0, result.stderr);

    const shared = path.join(home, '.agents', 'skills');
    assert.ok(fs.existsSync(path.join(shared, 'ro')), 'shared stays (serves dsh)');
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills', 'ro')), false, 'claude pruned');
    assert.equal(fs.existsSync(path.join(home, '.trae-cn', 'skills', 'ro')), false, 'trae-cn pruned');
    assert.equal(fs.existsSync(path.join(home, '.gemini', 'antigravity-cli', 'skills', 'ro')), false, 'agy pruned');
    assert.deepEqual(readManifest(shared), REPO_SKILLS, 'shared manifest intact');
  });

  test('--instructions --skills syncs both flows for the same agent selection', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--instructions', '--skills', '--agents', 'gemini']);
    assert.equal(result.status, 0, result.stderr);

    assert.ok(fs.readFileSync(targetPathIn(home, 'gemini'), 'utf8').includes(START_MARKER));
    assert.ok(fs.existsSync(path.join(home, '.agents', 'skills', 'ro')), 'shared synced (gemini)');
    assert.equal(fs.existsSync(path.join(home, '.claude', 'skills')), false, 'claude destination untouched');
  });

  test('flag conflicts for skills mode exit with an error', (t) => {
    const home = tmpDir(t);
    assert.equal(runCli(home, ['--skills', '--status', '--delete']).status, 1);
    assert.equal(runCli(home, ['--skills', '--status', '--dry-run']).status, 1);
  });

  test('gemini and agy share one config file and it is written once', (t) => {
    const home = tmpDir(t);
    const result = runCli(home, ['--agents', 'gemini,agy']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('updated (shared with Gemini CLI'));

    const content = fs.readFileSync(targetPathIn(home, 'agy'), 'utf8');
    assert.equal(countMarkers(content), 1);
  });

  test('deleting agy alone is refused because gemini shares the file', (t) => {
    const home = tmpDir(t);
    runCli(home, ['--agents', 'gemini,agy']);

    const result = runCli(home, ['--delete', '--agents', 'agy']);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.stdout.includes('also serves Gemini CLI'));
    assert.ok(fs.readFileSync(targetPathIn(home, 'agy'), 'utf8').includes(START_MARKER));
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
