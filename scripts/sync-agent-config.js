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
 *   - Trae CN        → ~/.trae-cn/user_rules/agent-dotfiles.md
 *
 * Usage:
 *   node scripts/sync-agent-config.js                    # Interactive (default: all selected)
 *   node scripts/sync-agent-config.js --agents cc,codex  # Sync specific agents (non-interactive)
 *   node scripts/sync-agent-config.js --agents all       # Sync all agents (non-interactive)
 *   node scripts/sync-agent-config.js --delete           # Remove managed blocks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(REPO_ROOT, 'AGENTS.template.md');

const TARGETS = [
  { id: 'claude',  agent: 'Claude Code',    path: '~/.claude/CLAUDE.md' },
  { id: 'codex',   agent: 'Codex',          path: '~/.codex/AGENTS.md' },
  { id: 'gemini',  agent: 'Gemini CLI',     path: '~/.gemini/GEMINI.md' },
  { id: 'opencode',agent: 'OpenCode',       path: '~/.config/opencode/AGENTS.md' },
  { id: 'trae-cn', agent: 'Trae CN',        path: '~/.trae-cn/user_rules/agent-dotfiles.md' },
];

const START_MARKER = '<!-- AGENT_DOTFILES_START -->';
const END_MARKER   = '<!-- AGENT_DOTFILES_END -->';
const MANAGE_NOTICE = '<!-- Source: AGENTS.template.md | Managed by scripts/sync-agent-config.js. Do not edit this block manually. -->';

function printHelp() {
  console.log(`
sync-agent-config.js

  Sync AGENTS.template.md to global config paths of various coding agents.
  Inserts or updates a marked text block inside each agent's global config file.

Usage:
  node scripts/sync-agent-config.js [options]

Options:
  -a, --agents <list>   Comma-separated agent IDs to sync (skips interactive)
                        Available: claude, codex, gemini, opencode, trae-cn
                        Use "all" to sync all agents without interactive prompt
  -d, --delete          Remove the managed block from each agent config
  -h, --help            Show this help message

Examples:
  node scripts/sync-agent-config.js                          # Interactive (default: all selected)
  node scripts/sync-agent-config.js --agents all             # Sync all (non-interactive)
  node scripts/sync-agent-config.js --agents claude,codex    # Sync specific agents (non-interactive)
  node scripts/sync-agent-config.js --delete                 # Remove all managed blocks
  node scripts/sync-agent-config.js --delete --agents claude # Remove from specific agents

Supported agents:
  claude     Claude Code    → ~/.claude/CLAUDE.md
  codex      Codex          → ~/.codex/AGENTS.md
  gemini     Gemini CLI     → ~/.gemini/GEMINI.md
  opencode   OpenCode       → ~/.config/opencode/AGENTS.md
  trae-cn    Trae CN        → ~/.trae-cn/user_rules/agent-dotfiles.md
`);
}

function expandHome(filePath) {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

function wrapContent(template) {
  return `${START_MARKER}\n${MANAGE_NOTICE}\n\n${template}\n${END_MARKER}`;
}

function removeBlock(targetPath) {
  if (!fs.existsSync(targetPath)) {
    return { action: 'missing', message: 'File does not exist' };
  }

  let content = fs.readFileSync(targetPath, 'utf8');
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx === -1 && endIdx === -1) {
    return { action: 'none', message: 'No managed block found' };
  }

  if (startIdx !== -1 && endIdx === -1) {
    throw new Error(`Found ${START_MARKER} but missing ${END_MARKER}; aborting to prevent data loss`);
  }

  if (startIdx === -1 && endIdx !== -1) {
    throw new Error(`Found ${END_MARKER} but missing ${START_MARKER}; aborting to prevent data loss`);
  }

  if (endIdx < startIdx) {
    throw new Error(`End marker appears before start marker; aborting to prevent data loss`);
  }

  let before = content.slice(0, startIdx);
  let after = content.slice(endIdx + END_MARKER.length);

  before = before.replace(/\n+$/g, '\n');
  after = after.replace(/^\n+/g, '\n');

  if ((before.trim() === '' || before === '\n') && after.trim() === '') {
    fs.writeFileSync(targetPath, '', 'utf8');
    return { action: 'cleared', message: 'Block removed, file is now empty' };
  }

  const separator = before.endsWith('\n') || after.startsWith('\n') ? '' : '\n';
  fs.writeFileSync(targetPath, before + separator + after, 'utf8');
  return { action: 'removed', message: 'Block removed' };
}

function syncFile(targetPath, template) {
  if (fs.existsSync(targetPath) && fs.lstatSync(targetPath).isSymbolicLink()) {
    fs.unlinkSync(targetPath);
  }

  const wrapped = wrapContent(template);

  if (!fs.existsSync(targetPath)) {
    fs.writeFileSync(targetPath, wrapped + '\n', 'utf8');
    return 'created';
  }

  let content = fs.readFileSync(targetPath, 'utf8');
  const startIdx = content.indexOf(START_MARKER);
  const endIdx = content.indexOf(END_MARKER);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = content.slice(0, startIdx);
    const after = content.slice(endIdx + END_MARKER.length);
    fs.writeFileSync(targetPath, before + wrapped + after, 'utf8');
    return 'updated';
  }

  const separator = content.endsWith('\n') ? '\n' : '\n\n';
  fs.writeFileSync(targetPath, content + separator + wrapped + '\n', 'utf8');
  return 'appended';
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
    console.error(`Error: Unknown agent IDs: ${invalid.join(', ')}`);
    console.error(`Available: ${TARGETS.map(t => t.id).join(', ')}`);
    process.exit(1);
  }

  return TARGETS.filter(t => agentIds.includes(t.id));
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

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const isDelete = args.includes('--delete') || args.includes('-d');

  // Determine which agents to operate on
  let selectedTargets;
  const agentsArg = args.find(a => a.startsWith('--agents') || a.startsWith('-a'));

  if (agentsArg) {
    let value = args[args.indexOf(agentsArg) + 1];
    if (agentsArg.includes('=')) {
      value = agentsArg.split('=')[1];
    }
    if (!value || value.startsWith('-')) {
      console.error('Error: --agents requires a value (comma-separated IDs or "all")');
      process.exit(1);
    }
    selectedTargets = resolveTargets(parseAgentIds(value));
  } else {
    // Default: interactive with all selected
    const selectedIds = await interactiveSelect();
    if (selectedIds.length === 0) {
      console.log('No agents selected. Exiting.');
      process.exit(0);
    }
    selectedTargets = TARGETS.filter(t => selectedIds.includes(t.id));
  }

  // Execute
  if (isDelete) {
    for (const target of selectedTargets) {
      const targetPath = expandHome(target.path);
      try {
        const result = removeBlock(targetPath);
        const icon = result.action === 'removed' ? '~' : '∅';
        console.log(`  ${icon} ${target.agent}: ${result.message} (${target.path})`);
      } catch (err) {
        console.error(`  ✗ ${target.agent}: ${err.message}`);
      }
    }
    return;
  }

  // Sync mode
  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Error: Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  const template = fs.readFileSync(SOURCE_FILE, 'utf8');

  // Remove blocks from unselected agents (coverage behavior)
  const unselectedTargets = TARGETS.filter(t => !selectedTargets.includes(t));
  for (const target of unselectedTargets) {
    const targetPath = expandHome(target.path);
    try {
      const result = removeBlock(targetPath);
      if (result.action === 'removed' || result.action === 'cleared') {
        console.log(`  - ${target.agent}: Block removed (not selected)`);
      }
    } catch (err) {
      console.error(`  ✗ ${target.agent}: ${err.message}`);
    }
  }

  // Sync selected agents
  for (const target of selectedTargets) {
    const targetPath = expandHome(target.path);
    const targetDir = path.dirname(targetPath);

    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
        console.log(`  Created directory: ${targetDir}`);
      }

      const action = syncFile(targetPath, template);
      const icon = action === 'updated' ? '~' : '+';
      console.log(`  ${icon} ${target.agent}: Block ${action.padEnd(8)} (${target.path})`);
    } catch (err) {
      console.error(`  ✗ ${target.agent}: ${err.message}`);
    }
  }
}

main();
