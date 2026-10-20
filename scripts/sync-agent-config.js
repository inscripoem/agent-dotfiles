#!/usr/bin/env node

/**
 * Sync AGENTS.template.md to global config paths of various coding agents.
 * Inserts or updates a marked text block inside each agent's global config file,
 * so template content coexists with any agent-specific settings.
 *
 * Supported agents:
 *   - Claude Code      → ~/.claude/CLAUDE.md
 *   - Codex (OpenAI)   → ~/.codex/AGENTS.md
 *   - DeepSeek Harness → ~/.dsh/AGENTS.md
 *   - Gemini CLI       → ~/.gemini/GEMINI.md
 *   - Antigravity CLI  → ~/.gemini/GEMINI.md (shares the file with Gemini CLI)
 *   - OpenCode         → ~/.config/opencode/AGENTS.md
 *   - Pi (pi.dev)      → ~/.pi/agent/AGENTS.md
 *   - Trae CN          → ~/.trae-cn/user_rules/agent-dotfiles.md
 *   - ZCode            → ~/.zcode/AGENTS.md
 *
 * Kinds (instruction blocks, skills) share one selection model: --agents
 * scopes every kind identically, a bare command covers all kinds, and
 * --instructions / --skills narrow the run to a single kind. New kinds plug
 * into the same defaults.
 *
 * Skills sync (--skills): distributes every <repo>/skills/<name>/ directory to
 * the user-level skills directories scanned by the supported agents. Each
 * destination declares which agents it serves, so --agents filters skills and
 * instructions with the same semantics. Ownership is recorded in a manifest
 * file inside each destination so that pruning and deletion never touch skills
 * installed by other tools.
 *
 * Interactive mode (no flags) asks in two steps: what to sync, then which
 * agents — one selection drives every kind.
 *
 * Symlink policy: a target that is a symbolic link is skipped with a warning by
 * default — silently breaking a link would take over configs managed by tools
 * like stow. Use --follow-symlinks to operate through symlinks; when several
 * agents link to the same file, it is written only once per run, and deletion
 * is refused unless every agent sharing the file is included.
 *
 * Usage:
 *   node scripts/sync-agent-config.js                        # Interactive (default: all selected)
 *   node scripts/sync-agent-config.js --agents claude,zcode  # Sync specific agents (non-interactive)
 *   node scripts/sync-agent-config.js --agents all           # Sync all agents (non-interactive)
 *   node scripts/sync-agent-config.js --skills               # Sync skills to all destinations
 *   node scripts/sync-agent-config.js --status               # Report managed-block state per agent
 *   node scripts/sync-agent-config.js --skills --status      # Report skills state per destination
 *   node scripts/sync-agent-config.js --dry-run --agents all # Preview changes without writing
 *   node scripts/sync-agent-config.js --delete               # Remove managed blocks
 *   node scripts/sync-agent-config.js --skills --delete      # Remove managed skills
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(REPO_ROOT, 'AGENTS.template.md');

const TARGETS = [
  { id: 'claude',   agent: 'Claude Code',      path: '~/.claude/CLAUDE.md' },
  { id: 'codex',    agent: 'Codex',            path: '~/.codex/AGENTS.md' },
  { id: 'dsh',      agent: 'DeepSeek Harness', path: '~/.dsh/AGENTS.md' },
  { id: 'gemini',   agent: 'Gemini CLI',       path: '~/.gemini/GEMINI.md' },
  { id: 'agy',      agent: 'Antigravity CLI',  path: '~/.gemini/GEMINI.md' },
  { id: 'opencode', agent: 'OpenCode',         path: '~/.config/opencode/AGENTS.md' },
  { id: 'pi',       agent: 'Pi (pi.dev)',      path: '~/.pi/agent/AGENTS.md' },
  { id: 'trae-cn',  agent: 'Trae CN',          path: '~/.trae-cn/user_rules/agent-dotfiles.md' },
  { id: 'zcode',    agent: 'ZCode',            path: '~/.zcode/AGENTS.md' },
];

const START_MARKER = '<!-- AGENT_DOTFILES_START -->';
const END_MARKER   = '<!-- AGENT_DOTFILES_END -->';
const MANAGE_NOTICE = '<!-- Source: AGENTS.template.md | Managed by scripts/sync-agent-config.js. Do not edit this block manually. -->';

function fail(message) {
  console.error(`Error: ${message}`);
  console.error('Run with --help for usage.');
  process.exit(1);
}

function printHelp() {
  console.log(`
sync-agent-config.js

  Sync agent dotfiles across coding agents. Two kinds share one model:

    verbs    sync (default) | --status | --delete
    kinds    instructions | skills            (bare = all; a kind flag narrows)
    scope    --agents <ids> | all             (default: all)

  A bare command is interactive: it asks what, then which agents. --status is
  read-only and runs directly.

Usage:
  node scripts/sync-agent-config.js [options]

Options:
  -a, --agents <list>   Scope: comma-separated agent IDs (claude, codex, dsh,
                        gemini, agy, opencode, pi, trae-cn, zcode; "all" is
                        everything). Bare sync/delete without it ask first.
  -d, --delete          Remove managed content instead of syncing it.
  --instructions        Limit the run to the instructions kind.
  --skills              Limit the run to the skills kind.
  --status              Report state instead of syncing (read-only).
  --dry-run             Preview without writing.
  --follow-symlinks     Write through symlinks instead of skipping them.
  --prune-unselected    With --agents, also remove unselected agents' managed
                        content (interactive runs always prune deselections).
  -h, --help            Show this help.

Examples:
  Sync
    node scripts/sync-agent-config.js                           # interactive
    node scripts/sync-agent-config.js --agents all              # every kind, everywhere
    node scripts/sync-agent-config.js --skills --agents claude  # one kind, one scope
  Inspect
    node scripts/sync-agent-config.js --status                  # every kind
    node scripts/sync-agent-config.js --skills --status         # one kind
    node scripts/sync-agent-config.js --dry-run --agents all    # preview
  Remove
    node scripts/sync-agent-config.js --delete                  # interactive
    node scripts/sync-agent-config.js --delete --agents claude  # one scope
    node scripts/sync-agent-config.js --skills --delete --agents all   # one kind

Agents (instruction file → skills destination):
  claude     ~/.claude/CLAUDE.md                       ~/.claude/skills
  codex      ~/.codex/AGENTS.md                        ~/.agents/skills  (shared)
  dsh        ~/.dsh/AGENTS.md                          ~/.agents/skills  (shared)
  gemini     ~/.gemini/GEMINI.md                       ~/.agents/skills  (shared)
  agy        ~/.gemini/GEMINI.md                       ~/.gemini/antigravity-cli/skills
  opencode   ~/.config/opencode/AGENTS.md              ~/.agents/skills  (shared)
  pi         ~/.pi/agent/AGENTS.md                     ~/.agents/skills  (shared)
  trae-cn    ~/.trae-cn/user_rules/agent-dotfiles.md   ~/.trae-cn/skills
  zcode      ~/.zcode/AGENTS.md                        ~/.agents/skills  (shared)

  ~/.agents/skills is the shared directory, read by every agent following the
  agentskills convention. agy and gemini also share one instruction file —
  selecting both writes it once.

Notes:
  Instruction blocks are marked blocks inside each agent's global config;
  updates rewrite only that block. Skills are copied from <repo>/skills/ and
  tracked via .agent-dotfiles-manifest.json in each destination — skills not
  owned by this script are never touched, and skills removed from the
  repository are pruned on the next sync. Symlinks are skipped unless
  --follow-symlinks is given; agents sharing one file are written once, and
  deletion refuses to touch a shared file unless every sharer is included.
`);
}

function expandHome(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

// lstat (not existsSync) so dangling links are detected too
function isSymlink(filePath) {
  try {
    return fs.lstatSync(filePath).isSymbolicLink();
  } catch {
    return false;
  }
}

// Resolve a target path to a stable identity for shared-file detection.
// realpathSync fails on dangling links, so fall back to resolving the raw
// link text against the link's directory.
function resolveTarget(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch {
    try {
      return path.resolve(path.dirname(filePath), fs.readlinkSync(filePath));
    } catch {
      return filePath;
    }
  }
}

function wrapContent(template) {
  return `${START_MARKER}\n${MANAGE_NOTICE}\n\n${template}\n${END_MARKER}`;
}

// Locate the managed block in file content.
//   absent  → no markers at all
//   present → both markers found in the right order
//   broken  → only one marker found, or END before START
function locateBlock(content) {
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);
  if (startIdx === -1 && endIdx === -1) {
    return { status: 'absent' };
  }
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return { status: 'broken' };
  }
  return { status: 'present', startIdx, endIdx };
}

function syncFile(targetPath, template, { dryRun = false } = {}) {
  const wrapped = wrapContent(template);

  if (!fs.existsSync(targetPath)) {
    if (!dryRun) {
      fs.writeFileSync(targetPath, wrapped + '\n', 'utf8');
    }
    return 'created';
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const block = locateBlock(content);

  if (block.status === 'broken') {
    throw new Error('Orphaned START/END marker(s); aborting to prevent data loss');
  }

  if (block.status === 'present') {
    const before = content.slice(0, block.startIdx);
    const after = content.slice(block.endIdx + END_MARKER.length);
    if (!dryRun) {
      fs.writeFileSync(targetPath, before + wrapped + after, 'utf8');
    }
    return 'updated';
  }

  if (!dryRun) {
    const separator = content.endsWith('\n') ? '\n' : '\n\n';
    fs.writeFileSync(targetPath, content + separator + wrapped + '\n', 'utf8');
  }
  return 'appended';
}

function removeBlock(targetPath, { dryRun = false } = {}) {
  if (!fs.existsSync(targetPath)) {
    return { action: 'missing', message: 'file does not exist' };
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const block = locateBlock(content);

  if (block.status === 'absent') {
    return { action: 'none', message: 'no managed block' };
  }
  if (block.status === 'broken') {
    throw new Error('Orphaned START/END marker(s); aborting to prevent data loss');
  }

  let before = content.slice(0, block.startIdx);
  let after = content.slice(block.endIdx + END_MARKER.length);

  before = before.replace(/\n+$/g, '\n');
  after = after.replace(/^\n+/g, '\n');

  if ((before.trim() === '' || before === '\n') && after.trim() === '') {
    if (!dryRun) {
      fs.writeFileSync(targetPath, '', 'utf8');
    }
    return { action: 'cleared', message: 'removed, file is now empty' };
  }

  if (!dryRun) {
    const separator = before.endsWith('\n') || after.startsWith('\n') ? '' : '\n';
    fs.writeFileSync(targetPath, before + separator + after, 'utf8');
  }
  return { action: 'removed', message: 'removed' };
}

// Read-only classification of a target for --status. `linked` reports whether
// the target path itself is a symlink so callers can annotate output.
function blockState(targetPath, template) {
  const linked = isSymlink(targetPath);
  if (!fs.existsSync(targetPath)) {
    return { state: linked ? 'symlink' : 'missing', linked };
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const block = locateBlock(content);
  if (block.status === 'absent') {
    return { state: 'no-block', linked };
  }
  if (block.status === 'broken') {
    return { state: 'broken', linked };
  }

  // Compare line-ending-insensitively: Windows checkouts (git autocrlf) hold
  // CRLF templates while existing blocks may have been written with LF.
  const normalize = s => s.replace(/\r\n/g, '\n');
  const current = normalize(content.slice(block.startIdx, block.endIdx + END_MARKER.length));
  const expected = normalize(wrapContent(template));
  return { state: current === expected ? 'in-sync' : 'stale', linked };
}

// ---------------------------------------------------------------------------
// Skills sync
//
// Skills live in <repo>/skills/<name>/ (each containing SKILL.md) and are
// distributed to every user-level directory the supported agents scan.
// Ownership of installed skills is recorded in a manifest file next to them,
// so pruning and deletion never touch skills installed by other tools.

const SKILLS_SOURCE_DIR = path.join(REPO_ROOT, 'skills');
const SKILLS_MANIFEST_NAME = '.agent-dotfiles-manifest.json';

const SKILL_DESTINATIONS = [
  { id: 'shared',  agent: 'Shared (~/.agents)', path: '~/.agents/skills',                 agents: ['zcode', 'codex', 'opencode', 'gemini', 'pi', 'dsh'] },
  { id: 'claude',  agent: 'Claude Code',        path: '~/.claude/skills',                 agents: ['claude'] },
  { id: 'trae-cn', agent: 'Trae CN',            path: '~/.trae-cn/skills',                agents: ['trae-cn'] },
  { id: 'agy',     agent: 'Antigravity CLI',    path: '~/.gemini/antigravity-cli/skills', agents: ['agy'] },
];

// Destinations serving the given agent selection: a destination is included
// when any of its agents is selected ("all" selects every destination).
function resolveSkillDestinations(agentIds) {
  if (agentIds.includes('all')) return SKILL_DESTINATIONS;
  return SKILL_DESTINATIONS.filter(d => d.agents.some(a => agentIds.includes(a)));
}

// Skill folder names directly under the source directory (dot entries and
// folders without a SKILL.md are not skills).
function listSourceSkills(sourceDir = SKILLS_SOURCE_DIR) {
  if (!fs.existsSync(sourceDir)) return [];
  return fs.readdirSync(sourceDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && !e.name.startsWith('.'))
    .map(e => e.name)
    .filter(name => fs.existsSync(path.join(sourceDir, name, 'SKILL.md')))
    .sort();
}

function readManifest(destSkillsDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(destSkillsDir, SKILLS_MANIFEST_NAME), 'utf8'));
    return Array.isArray(parsed) ? parsed.filter(s => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeManifest(destSkillsDir, names) {
  fs.writeFileSync(path.join(destSkillsDir, SKILLS_MANIFEST_NAME), JSON.stringify(names, null, 2) + '\n', 'utf8');
}

// Deterministic digest of a directory tree's relative paths and file contents,
// so an installed skill can be compared against its source without a diff walk.
function hashDir(dir) {
  const hash = crypto.createHash('sha256');
  const visit = (current, prefix) => {
    const entries = fs.readdirSync(current, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        visit(path.join(current, entry.name), rel);
      } else if (entry.isFile()) {
        hash.update(rel + '\0');
        hash.update(fs.readFileSync(path.join(current, entry.name)));
        hash.update('\0');
      }
    }
  };
  visit(dir, '');
  return hash.digest('hex');
}

// Classify an installed skill against its source:
//   in-sync → managed copy matches the source
//   stale   → managed but differs from the source
//   missing → not installed yet
//   foreign → present but not managed by this script (never touched)
//   symlink → present as a symlink (never followed or replaced)
function skillState(destSkillsDir, sourceDir, name, managed) {
  const dest = path.join(destSkillsDir, name);
  if (isSymlink(dest)) return 'symlink';
  if (!fs.existsSync(dest)) return 'missing';
  if (!managed.includes(name)) return 'foreign';
  return hashDir(dest) === hashDir(path.join(sourceDir, name)) ? 'in-sync' : 'stale';
}

// Decide everything that needs to happen in one destination before touching it.
function planSkillsSync(destSkillsDir, sourceDir, skillNames) {
  const managed = readManifest(destSkillsDir);
  const inSync = [];
  const install = [];
  const skip = [];
  for (const name of skillNames) {
    const state = skillState(destSkillsDir, sourceDir, name, managed);
    if (state === 'in-sync') {
      inSync.push(name);
    } else if (state === 'foreign' || state === 'symlink') {
      skip.push({ name, reason: state });
    } else {
      install.push({ name, action: state === 'stale' ? 'updated' : 'created' });
    }
  }
  const prune = managed.filter(n => !skillNames.includes(n) && !isSymlink(path.join(destSkillsDir, n)));
  return { inSync, install, skip, prune };
}

function installSkill(sourceDir, name, destSkillsDir, { dryRun = false } = {}) {
  const dest = path.join(destSkillsDir, name);
  const existed = fs.existsSync(dest);
  if (!dryRun) {
    fs.rmSync(dest, { recursive: true, force: true });
    fs.cpSync(path.join(sourceDir, name), dest, { recursive: true });
  }
  return existed ? 'updated' : 'created';
}

function uninstallSkills(destSkillsDir, names, { dryRun = false } = {}) {
  if (!dryRun) {
    for (const name of names) {
      fs.rmSync(path.join(destSkillsDir, name), { recursive: true, force: true });
    }
  }
}

function runSkillsSync(opts, destinations = SKILL_DESTINATIONS, { pruneOthers = false } = {}) {
  const skillNames = listSourceSkills();
  if (skillNames.length === 0) {
    console.log(`No skills found in ${SKILLS_SOURCE_DIR} (expected <name>/SKILL.md). Nothing to sync.`);
    return;
  }

  const notes = [];
  if (pruneOthers) {
    const selected = new Set(destinations.map(d => d.id));
    for (const dest of SKILL_DESTINATIONS) {
      if (!selected.has(dest.id)) {
        notes.push(...clearManagedSkills(dest, opts));
      }
    }
  }

  const outcomes = new Map();
  const pathWidth = Math.max(...destinations.map(d => d.path.length));

  for (const dest of destinations) {
    const destDir = expandHome(dest.path);
    try {
      if (!fs.existsSync(destDir)) {
        if (opts.dryRun) {
          notes.push(`• ${dest.path}: directory would be created`);
        } else {
          fs.mkdirSync(destDir, { recursive: true });
        }
      }

      const plan = planSkillsSync(destDir, SKILLS_SOURCE_DIR, skillNames);
      for (const name of skillNames) {
        let icon;
        let text;
        if (plan.inSync.includes(name)) {
          icon = '=';
          text = 'in-sync';
        } else if (plan.install.some(i => i.name === name)) {
          const actual = installSkill(SKILLS_SOURCE_DIR, name, destDir, { dryRun: opts.dryRun });
          icon = actual === 'updated' ? '~' : '+';
          text = actual;
        } else {
          const skip = plan.skip.find(s => s.name === name);
          icon = skip.reason === 'foreign' ? '!' : '→';
          text = skip.reason === 'foreign' ? 'foreign — not managed' : 'skipped (symlink)';
        }
        if (!outcomes.has(name)) outcomes.set(name, []);
        outcomes.get(name).push({ dest, icon, text });
      }

      if (plan.prune.length > 0) {
        uninstallSkills(destDir, plan.prune, { dryRun: opts.dryRun });
        notes.push(`- ${dest.path}: pruned ${plan.prune.join(', ')} (no longer in source)`);
      }
      if (!opts.dryRun) {
        // Skipped skills stay unowned so they are never overwritten or pruned later.
        const skipped = new Set(plan.skip.map(s => s.name));
        writeManifest(destDir, skillNames.filter(n => !skipped.has(n)));
      }
    } catch (err) {
      notes.push(`✗ ${dest.path}: ${err.message}`);
    }
  }

  skillNames.forEach((name, skillIndex) => {
    const skillBranch = skillIndex === skillNames.length - 1 ? '└──' : '├──';
    const childPrefix = skillIndex === skillNames.length - 1 ? '    ' : '│   ';
    console.log(`${skillBranch} ${name}`);

    const leaves = outcomes.get(name) ?? [];
    leaves.forEach((leaf, leafIndex) => {
      const leafBranch = leafIndex === leaves.length - 1 ? '└──' : '├──';
      console.log(`${childPrefix}${leafBranch} ${leaf.dest.path.padEnd(pathWidth)}  ${leaf.icon} ${leaf.text}`);
    });
  });

  for (const note of notes) {
    console.log(`  ${note}`);
  }
}

// Remove managed skills in one destination; returns note lines (no output).
function clearManagedSkills(dest, opts) {
  const notes = [];
  const destDir = expandHome(dest.path);
  try {
    const managed = readManifest(destDir);
    const linked = managed.filter(n => isSymlink(path.join(destDir, n)));
    const removable = managed.filter(n => !linked.includes(n));
    if (managed.length === 0 && !fs.existsSync(path.join(destDir, SKILLS_MANIFEST_NAME))) {
      notes.push(`∅ ${dest.path}: no managed skills`);
      return notes;
    }
    if (removable.length > 0) {
      uninstallSkills(destDir, removable, { dryRun: opts.dryRun });
      notes.push(`~ ${dest.path}: removed ${removable.join(', ')}`);
    } else {
      notes.push(`∅ ${dest.path}: nothing removable`);
    }
    if (!opts.dryRun) {
      if (linked.length > 0) {
        writeManifest(destDir, linked);
      } else {
        fs.rmSync(path.join(destDir, SKILLS_MANIFEST_NAME), { force: true });
      }
    }
    for (const name of linked) {
      notes.push(`→ ${dest.path}/${name}: now a symlink — left untouched, dropped from manifest`);
    }
  } catch (err) {
    notes.push(`✗ ${dest.path}: ${err.message}`);
  }
  return notes;
}

function runSkillsDelete(opts, destinations = SKILL_DESTINATIONS) {
  for (const dest of destinations) {
    for (const note of clearManagedSkills(dest, opts)) {
      console.log(`  ${note}`);
    }
  }
}

function runSkillsStatus(opts, destinations = SKILL_DESTINATIONS) {
  const skillNames = listSourceSkills();
  if (skillNames.length === 0) {
    console.log(`No skills found in ${SKILLS_SOURCE_DIR} (expected <name>/SKILL.md).`);
    return;
  }

  const pathWidth = Math.max(...destinations.map(d => d.path.length));
  skillNames.forEach((name, skillIndex) => {
    const skillBranch = skillIndex === skillNames.length - 1 ? '└──' : '├──';
    const childPrefix = skillIndex === skillNames.length - 1 ? '    ' : '│   ';
    console.log(`${skillBranch} ${name}`);

    destinations.forEach((dest, destIndex) => {
      const destDir = expandHome(dest.path);
      const state = skillState(destDir, SKILLS_SOURCE_DIR, name, readManifest(destDir));
      const symbols = {
        'in-sync': '✓', 'stale': '~', 'missing': '+', 'foreign': '!', 'symlink': '→',
      };
      const symbol = symbols[state] ?? '!';
      const branch = destIndex === destinations.length - 1 ? '└──' : '├──';
      console.log(
        `${childPrefix}${branch} ${dest.path.padEnd(pathWidth)}  ${symbol} ${state}  ← ${dest.agents.join(', ')}`,
      );
    });
  });

  for (const dest of destinations) {
    const destDir = expandHome(dest.path);
    const orphaned = readManifest(destDir).filter(n => !skillNames.includes(n));
    if (orphaned.length > 0) {
      console.log(`  ! managed but no longer in source, pruned on next sync: ${orphaned.join(', ')} (${dest.path})`);
    }
  }
}

function parseAgentIds(input) {
  return input.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function resolveTargets(agentIds) {
  if (agentIds.includes('all')) {
    return TARGETS;
  }

  const validIds = new Set(TARGETS.map(t => t.id));
  const invalid = agentIds.filter(id => !validIds.has(id));
  if (invalid.length > 0) {
    fail(`Unknown agent IDs: ${invalid.join(', ')}. Available: ${TARGETS.map(t => t.id).join(', ')}`);
  }

  return TARGETS.filter(t => agentIds.includes(t.id));
}

function parseArgs(argv) {
  const opts = {
    agents: null,
    delete: false,
    dryRun: false,
    follow: false,
    instructions: false,
    prune: false,
    skills: false,
    status: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      opts.help = true;
    } else if (arg === '--delete' || arg === '-d') {
      opts.delete = true;
    } else if (arg === '--dry-run') {
      opts.dryRun = true;
    } else if (arg === '--follow-symlinks') {
      opts.follow = true;
    } else if (arg === '--instructions') {
      opts.instructions = true;
    } else if (arg === '--prune-unselected') {
      opts.prune = true;
    } else if (arg === '--skills') {
      opts.skills = true;
    } else if (arg === '--status') {
      opts.status = true;
    } else if (arg === '--agents' || arg === '-a' || arg.startsWith('--agents=')) {
      const value = arg.includes('=') ? arg.split('=')[1] : argv[++i];
      if (!value || value.startsWith('-')) {
        fail('--agents requires a value (comma-separated IDs or "all")');
      }
      opts.agents = value;
    } else {
      fail(`Unknown argument: ${arg}`);
    }
  }
  return opts;
}

// Generic interactive multi-select over { id, label } items; returns selected ids.
async function multiSelect({ title, items, hint }) {
  const selected = new Set(items.map(i => i.id));
  let cursor = 0;
  let renderCount = 0;
  const lineCount = items.length + 2; // list + hint + empty line

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 0,
  });

  function render() {
    if (renderCount === 0) {
      // First render: clear and print header
      process.stdout.write('\x1B[2J\x1B[H');
      console.log(`${title}\n`);
    } else {
      // Subsequent: move cursor up to rewrite
      process.stdout.write(`\x1B[${lineCount}A`);
    }

    items.forEach((item, i) => {
      const check = selected.has(item.id) ? '●' : '○';
      const pointer = i === cursor ? '❯' : ' ';
      console.log(`  ${pointer} ${check}  ${item.label}`);
    });
    console.log(`\n${hint}`);

    renderCount++;
  }

  return new Promise((resolve) => {
    render();

    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    readline.emitKeypressEvents(process.stdin);

    const onKeypress = (str, key) => {
      if (!key) return;

      if (key.name === 'up' || (key.name === 'k' && !key.ctrl)) {
        cursor = (cursor - 1 + items.length) % items.length;
        render();
      } else if (key.name === 'down' || (key.name === 'j' && !key.ctrl)) {
        cursor = (cursor + 1) % items.length;
        render();
      } else if (key.name === 'space') {
        const id = items[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
      } else if (str === 'a') {
        items.forEach(i => selected.add(i.id));
        render();
      } else if (str === 'n') {
        selected.clear();
        render();
      } else if (key.name === 'return') {
        cleanup();
        resolve([...selected]);
      } else if (key.ctrl && key.name === 'c') {
        cleanup();
        process.exit(0);
      }
    };

    function cleanup() {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      process.stdin.removeListener('keypress', onKeypress);
      rl.close();
    }

    process.stdin.on('keypress', onKeypress);
  });
}

function interactiveSelectAgents() {
  return multiSelect({
    title: 'Select agents to sync (Space to toggle, Enter to confirm):',
    items: TARGETS.map(t => ({ id: t.id, label: `${t.agent.padEnd(16)} (${t.id})` })),
    hint: '↑↓ Navigate  Space Toggle  Enter Confirm  a All  n None',
  });
}

function interactiveSelectKinds(verb = 'sync') {
  return multiSelect({
    title: `Select what to ${verb} (Space to toggle, Enter to confirm):`,
    items: [
      { id: 'instructions', label: 'Instruction blocks (per-agent AGENTS.md files)' },
      { id: 'skills', label: 'Skills (skills/ → agent skill directories)' },
    ],
    hint: '↑↓ Navigate  Space Toggle  Enter Confirm  a All  n None',
  });
}

function runStatus(targets, opts) {
  const template = fs.readFileSync(SOURCE_FILE, 'utf8');
  const idWidth = Math.max(...targets.map(t => t.id.length));

  targets.forEach((target, index) => {
    const targetPath = expandHome(target.path);
    let symbol;
    let text;

    if (isSymlink(targetPath) && !opts.follow) {
      symbol = '→';
      text = 'symlink (skipped by default; use --follow-symlinks to inspect)';
    } else {
      const { state, linked } = blockState(targetPath, template);
      const via = linked ? ` (via symlink → ${fs.readlinkSync(targetPath)})` : '';
      switch (state) {
        case 'in-sync':  symbol = '✓'; text = `in-sync${via}`; break;
        case 'stale':    symbol = '~'; text = `stale — managed block differs from current template${via}`; break;
        case 'no-block': symbol = '-'; text = 'no managed block'; break;
        case 'missing':  symbol = '+'; text = 'missing — file will be created on next sync'; break;
        case 'symlink':  symbol = '→'; text = 'dangling symlink (skipped by default)'; break;
        case 'broken':   symbol = '!'; text = 'broken markers — fix the file manually before syncing'; break;
        default:         symbol = '!'; text = state; break;
      }
    }

    const branch = index === targets.length - 1 ? '└──' : '├──';
    console.log(`${branch} ${target.id.padEnd(idWidth)}  ${symbol} ${text}  ${target.path}`);
  });
}

// Render agent-keyed rows as a one-level tree in TARGETS order.
function renderIdTree(rows) {
  if (rows.length === 0) return;
  const idWidth = Math.max(...rows.map(r => r.id.length));
  rows.forEach((row, index) => {
    const branch = index === rows.length - 1 ? '└──' : '├──';
    console.log(`${branch} ${row.id.padEnd(idWidth)}  ${row.symbol} ${row.text}  ${row.path}`);
  });
}

function runDelete(targets, opts) {
  const deleteSet = new Set(targets);
  const reals = new Map(TARGETS.map(t => [t.id, resolveTarget(expandHome(t.path))]));
  const rows = [];

  for (const target of targets) {
    const targetPath = expandHome(target.path);
    try {
      if (isSymlink(targetPath) && !opts.follow) {
        rows.push({ id: target.id, symbol: '→', text: 'skipped (symlink)', path: target.path });
        continue;
      }

      if (!fs.existsSync(targetPath)) {
        rows.push({ id: target.id, symbol: '∅', text: 'file does not exist', path: target.path });
        continue;
      }

      const real = reals.get(target.id);
      const sharers = TARGETS.filter(o => o.id !== target.id && !deleteSet.has(o) && reals.get(o.id) === real);
      if (sharers.length > 0) {
        const names = sharers.map(s => s.agent).join(', ');
        rows.push({ id: target.id, symbol: '!', text: `shared file also serves ${names} — include them or break the link`, path: target.path });
        continue;
      }

      const result = removeBlock(targetPath, { dryRun: opts.dryRun });
      const symbol = result.action === 'removed' || result.action === 'cleared' ? '~' : '∅';
      rows.push({ id: target.id, symbol, text: result.message, path: target.path });
    } catch (err) {
      rows.push({ id: target.id, symbol: '✗', text: err.message, path: target.path });
    }
  }

  renderIdTree(rows);
}

function runSync(selectedTargets, interactive, opts) {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Error: Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const template = fs.readFileSync(SOURCE_FILE, 'utf8');
  const rows = [];
  const notes = [];

  // Coverage behavior: in interactive mode deselection is explicit, so
  // unselected agents always get their blocks removed. With --agents, pruning
  // unselected agents only happens on request (--prune-unselected).
  if (interactive || opts.prune) {
    const unselectedTargets = TARGETS.filter(t => !selectedTargets.includes(t));
    for (const target of unselectedTargets) {
      const targetPath = expandHome(target.path);
      try {
        if (isSymlink(targetPath) && !opts.follow) {
          rows.push({ id: target.id, symbol: '→', text: 'skipped (symlink)', path: target.path });
          continue;
        }
        const result = removeBlock(targetPath, { dryRun: opts.dryRun });
        if (result.action === 'removed' || result.action === 'cleared') {
          rows.push({ id: target.id, symbol: '-', text: 'removed (not selected)', path: target.path });
        }
      } catch (err) {
        console.error(`  ✗ ${target.agent}: ${err.message}`);
      }
    }
  }

  // writtenReals tracks which file each agent was synced to (by realpath), so
  // agents whose links resolve to the same file are written only once.
  const writtenReals = new Map();

  for (const target of selectedTargets) {
    const targetPath = expandHome(target.path);
    try {
      const linked = isSymlink(targetPath);
      if (linked && !opts.follow) {
        rows.push({ id: target.id, symbol: '→', text: 'skipped (symlink)', path: target.path });
        continue;
      }

      const real = resolveTarget(targetPath);
      const owner = writtenReals.get(real);
      if (owner) {
        rows.push({ id: target.id, symbol: '~', text: `updated (shared with ${owner.agent}, written once)`, path: target.path });
        continue;
      }
      writtenReals.set(real, target);

      const targetDir = path.dirname(targetPath);
      if (!linked && !fs.existsSync(targetDir)) {
        if (opts.dryRun) {
          notes.push(`• ${target.agent}: directory would be created (${targetDir})`);
        } else {
          fs.mkdirSync(targetDir, { recursive: true });
        }
      }

      // Skip the write when the managed block already matches the template,
      // so "updated" always means the content actually changed.
      if (blockState(targetPath, template).state === 'in-sync') {
        rows.push({ id: target.id, symbol: '=', text: 'in-sync', path: target.path });
        continue;
      }

      const action = syncFile(targetPath, template, { dryRun: opts.dryRun });
      rows.push({ id: target.id, symbol: action === 'updated' ? '~' : '+', text: action, path: target.path });
    } catch (err) {
      console.error(`  ✗ ${target.agent}: ${err.message}`);
    }
  }

  const order = new Map(TARGETS.map((t, i) => [t.id, i]));
  rows.sort((a, b) => order.get(a.id) - order.get(b.id));
  renderIdTree(rows);
  for (const note of notes) {
    console.log(`  ${note}`);
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    printHelp();
    return;
  }

  if (opts.status && opts.delete) {
    fail('--status and --delete cannot be combined');
  }
  if (opts.status && opts.dryRun) {
    fail('--status is read-only; --dry-run is not needed');
  }
  if (opts.dryRun) {
    console.log('(dry run — no changes will be written)');
  }

  const agentIds = opts.agents !== null ? parseAgentIds(opts.agents) : null;
  // Kinds: a kind flag narrows the run; with no kind flag every kind runs, so
  // categories added later are covered by bare commands automatically.
  const anyKindFlag = opts.instructions || opts.skills;
  const kinds = {
    instructions: opts.instructions || !anyKindFlag,
    skills: opts.skills || !anyKindFlag,
  };

  if (opts.status) {
    if (kinds.instructions) {
      console.log('Instructions:');
      runStatus(agentIds === null ? TARGETS : resolveTargets(agentIds), opts);
    }
    if (kinds.skills) {
      console.log('\nSkills:');
      runSkillsStatus(opts, resolveSkillDestinations(agentIds ?? ['all']));
    }
    return;
  }

  if (opts.delete) {
    let selectedKinds = kinds;
    let ids = agentIds;
    if (!anyKindFlag && ids === null) {
      // Destructive and unscoped: confirm both steps interactively, same
      // shape as an interactive sync.
      const picked = await interactiveSelectKinds('remove');
      if (picked.length === 0) {
        console.log('Nothing selected. Exiting.');
        return;
      }
      selectedKinds = {
        instructions: picked.includes('instructions'),
        skills: picked.includes('skills'),
      };
      ids = await interactiveSelectAgents();
      if (ids.length === 0) {
        console.log('No agents selected. Exiting.');
        return;
      }
    } else if (ids === null) {
      const picked = await interactiveSelectAgents();
      if (picked.length === 0) {
        console.log('No agents selected. Exiting.');
        return;
      }
      ids = picked;
    }
    if (selectedKinds.instructions) {
      console.log('Instructions:');
      runDelete(resolveTargets(ids), opts);
    }
    if (selectedKinds.skills) {
      console.log('\nSkills:');
      runSkillsDelete(opts, resolveSkillDestinations(ids));
    }
    return;
  }

  // Sync: fully interactive when nothing is explicit.
  if (!anyKindFlag && agentIds === null) {
    const picked = await interactiveSelectKinds();
    if (picked.length === 0) {
      console.log('Nothing selected. Exiting.');
      return;
    }
    const ids = await interactiveSelectAgents();
    if (ids.length === 0) {
      console.log('No agents selected. Exiting.');
      return;
    }
    if (picked.includes('instructions')) {
      console.log('Instructions:');
      runSync(resolveTargets(ids), true, opts);
    }
    if (picked.includes('skills')) {
      console.log('\nSkills:');
      runSkillsSync(opts, resolveSkillDestinations(ids), { pruneOthers: true });
    }
    return;
  }

  const ids = agentIds ?? ['all'];
  if (kinds.instructions) {
    console.log('Instructions:');
    runSync(resolveTargets(ids), false, opts);
  }
  if (kinds.skills) {
    console.log('\nSkills:');
    runSkillsSync(opts, resolveSkillDestinations(ids), { pruneOthers: opts.prune });
  }
}

module.exports = {
  TARGETS,
  START_MARKER,
  END_MARKER,
  MANAGE_NOTICE,
  SKILLS_SOURCE_DIR,
  SKILLS_MANIFEST_NAME,
  SKILL_DESTINATIONS,
  expandHome,
  isSymlink,
  resolveTarget,
  wrapContent,
  locateBlock,
  syncFile,
  removeBlock,
  blockState,
  listSourceSkills,
  readManifest,
  writeManifest,
  hashDir,
  skillState,
  planSkillsSync,
  installSkill,
  uninstallSkills,
  resolveSkillDestinations,
  parseAgentIds,
  resolveTargets,
  parseArgs,
};

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
