#!/usr/bin/env node

/**
 * Sync AGENTS.template.md to global config paths of various coding agents.
 * Inserts or updates a marked text block inside each agent's global config file,
 * so template content coexists with any agent-specific settings.
 *
 * Supported agents:
 *   - Claude Code    → ~/.claude/CLAUDE.md
 *   - Codex (OpenAI) → ~/.codex/AGENTS.md
 *   - Gemini CLI     → ~/.gemini/GEMINI.md
 *   - OpenCode       → ~/.config/opencode/AGENTS.md
 *   - Pi (pi.dev)    → ~/.pi/agent/AGENTS.md
 *   - Trae CN        → ~/.trae-cn/user_rules/agent-dotfiles.md
 *   - ZCode          → ~/.zcode/AGENTS.md
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
 *   node scripts/sync-agent-config.js --status               # Report managed-block state per agent
 *   node scripts/sync-agent-config.js --dry-run --agents all # Preview changes without writing
 *   node scripts/sync-agent-config.js --delete               # Remove managed blocks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(REPO_ROOT, 'AGENTS.template.md');

const TARGETS = [
  { id: 'claude',   agent: 'Claude Code', path: '~/.claude/CLAUDE.md' },
  { id: 'codex',    agent: 'Codex',       path: '~/.codex/AGENTS.md' },
  { id: 'gemini',   agent: 'Gemini CLI',  path: '~/.gemini/GEMINI.md' },
  { id: 'opencode', agent: 'OpenCode',    path: '~/.config/opencode/AGENTS.md' },
  { id: 'pi',       agent: 'Pi (pi.dev)', path: '~/.pi/agent/AGENTS.md' },
  { id: 'trae-cn',  agent: 'Trae CN',     path: '~/.trae-cn/user_rules/agent-dotfiles.md' },
  { id: 'zcode',    agent: 'ZCode',       path: '~/.zcode/AGENTS.md' },
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

  Sync AGENTS.template.md to global config paths of various coding agents.
  Inserts or updates a marked text block inside each agent's global config file.

Usage:
  node scripts/sync-agent-config.js [options]

Options:
  -a, --agents <list>   Comma-separated agent IDs to sync (skips interactive)
                        Available: claude, codex, gemini, opencode, pi, trae-cn, zcode
                        Use "all" to sync all agents without interactive prompt
  -d, --delete          Remove the managed block from each agent config
  --status              Report managed-block state per agent (read-only)
  --dry-run             Preview actions without writing any file
  --follow-symlinks     Operate through symbolic links instead of skipping them
  --prune-unselected    With --agents, also remove blocks from unselected agents
                        (interactive mode always prunes deselected agents)
  -h, --help            Show this help message

Examples:
  node scripts/sync-agent-config.js                          # Interactive (default: all selected)
  node scripts/sync-agent-config.js --agents all             # Sync all (non-interactive)
  node scripts/sync-agent-config.js --agents claude,zcode    # Sync specific agents (non-interactive)
  node scripts/sync-agent-config.js --dry-run --agents all   # Preview without writing
  node scripts/sync-agent-config.js --status                 # Check which agents are in sync
  node scripts/sync-agent-config.js --delete                 # Remove all managed blocks
  node scripts/sync-agent-config.js --delete --agents claude # Remove from specific agents

Symlink policy:
  Targets that are symbolic links are skipped with a warning by default.
  With --follow-symlinks the script writes through links; agents linking to
  the same file are deduplicated (the file is written once per run). When
  deleting, a shared file is left alone unless every agent using it is
  included in the deletion.

Supported agents:
  claude     Claude Code    → ~/.claude/CLAUDE.md
  codex      Codex          → ~/.codex/AGENTS.md
  gemini     Gemini CLI     → ~/.gemini/GEMINI.md
  opencode   OpenCode       → ~/.config/opencode/AGENTS.md
  pi         Pi (pi.dev)    → ~/.pi/agent/AGENTS.md
  trae-cn    Trae CN        → ~/.trae-cn/user_rules/agent-dotfiles.md
  zcode      ZCode          → ~/.zcode/AGENTS.md
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
    return { action: 'missing', message: 'File does not exist' };
  }

  const content = fs.readFileSync(targetPath, 'utf8');
  const block = locateBlock(content);

  if (block.status === 'absent') {
    return { action: 'none', message: 'No managed block found' };
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
    return { action: 'cleared', message: 'Block removed, file is now empty' };
  }

  if (!dryRun) {
    const separator = before.endsWith('\n') || after.startsWith('\n') ? '' : '\n';
    fs.writeFileSync(targetPath, before + separator + after, 'utf8');
  }
  return { action: 'removed', message: 'Block removed' };
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

  const current = content.slice(block.startIdx, block.endIdx + END_MARKER.length);
  const expected = wrapContent(template);
  return { state: current === expected ? 'in-sync' : 'stale', linked };
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
    prune: false,
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
    } else if (arg === '--prune-unselected') {
      opts.prune = true;
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

async function interactiveSelect() {
  const selected = new Set(TARGETS.map(t => t.id));
  let cursor = 0;
  let renderCount = 0;
  const lineCount = TARGETS.length + 2; // list + hint + empty line

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    historySize: 0,
  });

  function render() {
    if (renderCount === 0) {
      // First render: clear and print header
      process.stdout.write('\x1B[2J\x1B[H');
      console.log('Select agents to sync (Space to toggle, Enter to confirm):\n');
    } else {
      // Subsequent: move cursor up to rewrite
      process.stdout.write(`\x1B[${lineCount}A`);
    }

    TARGETS.forEach((t, i) => {
      const check = selected.has(t.id) ? '●' : '○';
      const pointer = i === cursor ? '❯' : ' ';
      console.log(`  ${pointer} ${check}  ${t.agent.padEnd(14)} (${t.id})`);
    });
    console.log('\n↑↓ Navigate  Space Toggle  Enter Confirm  a All  n None');

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
        cursor = (cursor - 1 + TARGETS.length) % TARGETS.length;
        render();
      } else if (key.name === 'down' || (key.name === 'j' && !key.ctrl)) {
        cursor = (cursor + 1) % TARGETS.length;
        render();
      } else if (key.name === 'space') {
        const id = TARGETS[cursor].id;
        if (selected.has(id)) selected.delete(id);
        else selected.add(id);
        render();
      } else if (str === 'a') {
        TARGETS.forEach(t => selected.add(t.id));
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

function runStatus(targets, opts) {
  const template = fs.readFileSync(SOURCE_FILE, 'utf8');

  for (const target of targets) {
    const targetPath = expandHome(target.path);
    let line;

    if (isSymlink(targetPath) && !opts.follow) {
      line = '→ symlink (skipped by default; use --follow-symlinks to inspect)';
    } else {
      const { state, linked } = blockState(targetPath, template);
      const via = linked ? ` (via symlink → ${fs.readlinkSync(targetPath)})` : '';
      switch (state) {
        case 'in-sync':  line = `✓ in-sync${via}`; break;
        case 'stale':    line = `~ stale — managed block differs from current template${via}`; break;
        case 'no-block': line = `- no managed block${via}`; break;
        case 'missing':  line = `+ missing — file will be created on next sync`; break;
        case 'symlink':  line = `→ dangling symlink (skipped by default)`; break;
        case 'broken':   line = `! broken markers — fix the file manually before syncing`; break;
        default:         line = `! ${state}`; break;
      }
    }
    console.log(`  ${line} (${target.path})`);
  }
}

function runDelete(targets, opts) {
  const deleteSet = new Set(targets);
  const reals = new Map(TARGETS.map(t => [t.id, resolveTarget(expandHome(t.path))]));

  for (const target of targets) {
    const targetPath = expandHome(target.path);
    try {
      if (isSymlink(targetPath) && !opts.follow) {
        console.log(`  → ${target.agent}: Symlink skipped (use --follow-symlinks to operate through it) (${target.path})`);
        continue;
      }

      if (!fs.existsSync(targetPath)) {
        console.log(`  ∅ ${target.agent}: File does not exist (${target.path})`);
        continue;
      }

      const real = reals.get(target.id);
      const sharers = TARGETS.filter(o => o.id !== target.id && !deleteSet.has(o) && reals.get(o.id) === real);
      if (sharers.length > 0) {
        const names = sharers.map(s => s.agent).join(', ');
        console.log(`  ! ${target.agent}: Skipped — the same file also serves ${names}; include them in the deletion or break the link first`);
        continue;
      }

      const result = removeBlock(targetPath, { dryRun: opts.dryRun });
      const icon = result.action === 'removed' || result.action === 'cleared' ? '~' : '∅';
      const suffix = opts.dryRun ? ' (dry run)' : '';
      console.log(`  ${icon} ${target.agent}: ${result.message}${suffix} (${target.path})`);
    } catch (err) {
      console.error(`  ✗ ${target.agent}: ${err.message}`);
    }
  }
}

function runSync(selectedTargets, interactive, opts) {
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Error: Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }
  const template = fs.readFileSync(SOURCE_FILE, 'utf8');

  if (opts.dryRun) {
    console.log('(dry run — no changes will be written)\n');
  }

  // Coverage behavior: in interactive mode deselection is explicit, so
  // unselected agents always get their blocks removed. With --agents, pruning
  // unselected agents only happens on request (--prune-unselected).
  if (interactive || opts.prune) {
    const unselectedTargets = TARGETS.filter(t => !selectedTargets.includes(t));
    for (const target of unselectedTargets) {
      const targetPath = expandHome(target.path);
      try {
        if (isSymlink(targetPath) && !opts.follow) {
          console.log(`  → ${target.agent}: Symlink skipped (not selected)`);
          continue;
        }
        const result = removeBlock(targetPath, { dryRun: opts.dryRun });
        if (result.action === 'removed' || result.action === 'cleared') {
          const suffix = opts.dryRun ? ' (dry run)' : '';
          console.log(`  - ${target.agent}: Block removed (not selected)${suffix}`);
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
        console.log(`  → ${target.agent}: Symlink skipped (use --follow-symlinks to operate through it) (${target.path})`);
        continue;
      }

      const real = resolveTarget(targetPath);
      const owner = writtenReals.get(real);
      if (owner) {
        console.log(`  = ${target.agent}: Shared file with ${owner.agent}, already synced (${target.path})`);
        continue;
      }
      writtenReals.set(real, target);

      const targetDir = path.dirname(targetPath);
      if (!linked && !fs.existsSync(targetDir)) {
        if (opts.dryRun) {
          console.log(`  • ${target.agent}: directory would be created: ${targetDir}`);
        } else {
          fs.mkdirSync(targetDir, { recursive: true });
          console.log(`  Created directory: ${targetDir}`);
        }
      }

      const action = syncFile(targetPath, template, { dryRun: opts.dryRun });
      const icon = action === 'updated' ? '~' : '+';
      const suffix = opts.dryRun ? ' (dry run)' : '';
      console.log(`  ${icon} ${target.agent}: Block ${action.padEnd(8)}${suffix} (${target.path})`);
    } catch (err) {
      console.error(`  ✗ ${target.agent}: ${err.message}`);
    }
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

  // Determine which agents to operate on
  let selectedTargets;
  let interactive = false;

  if (opts.agents !== null) {
    selectedTargets = resolveTargets(parseAgentIds(opts.agents));
  } else if (opts.status) {
    selectedTargets = TARGETS;
  } else {
    interactive = true;
    const selectedIds = await interactiveSelect();
    if (selectedIds.length === 0) {
      console.log('No agents selected. Exiting.');
      return;
    }
    selectedTargets = TARGETS.filter(t => selectedIds.includes(t.id));
  }

  if (opts.status) {
    runStatus(selectedTargets, opts);
    return;
  }

  if (opts.delete) {
    runDelete(selectedTargets, opts);
    return;
  }

  runSync(selectedTargets, interactive, opts);
}

module.exports = {
  TARGETS,
  START_MARKER,
  END_MARKER,
  MANAGE_NOTICE,
  expandHome,
  isSymlink,
  resolveTarget,
  wrapContent,
  locateBlock,
  syncFile,
  removeBlock,
  blockState,
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
