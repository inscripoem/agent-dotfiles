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
 *
 * Usage:
 *   node scripts/sync-agent-config.js        # Sync / update managed blocks
 *   node scripts/sync-agent-config.js --delete # Remove managed blocks
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_FILE = path.join(REPO_ROOT, 'AGENTS.template.md');

const TARGETS = [
  { agent: 'Claude Code',    path: '~/.claude/CLAUDE.md' },
  { agent: 'Codex',          path: '~/.codex/AGENTS.md' },
  { agent: 'Gemini CLI',     path: '~/.gemini/GEMINI.md' },
  { agent: 'OpenCode',       path: '~/.config/opencode/AGENTS.md' },
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
  -d, --delete    Remove the managed block from each agent config
  -h, --help      Show this help message

Supported agents:
  - Claude Code    → ~/.claude/CLAUDE.md
  - Codex (OpenAI) → ~/.codex/AGENTS.md
  - Gemini CLI     → ~/.gemini/GEMINI.md
  - OpenCode       → ~/.config/opencode/AGENTS.md
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

  // Clean up extra newlines at the boundary
  before = before.replace(/\n+$/g, '\n');
  after = after.replace(/^\n+/g, '\n');

  // If after is just a newline and before is empty or whitespace, trim it
  if ((before.trim() === '' || before === '\n') && after.trim() === '') {
    fs.writeFileSync(targetPath, '', 'utf8');
    return { action: 'cleared', message: 'Block removed, file is now empty' };
  }

  const separator = before.endsWith('\n') || after.startsWith('\n') ? '' : '\n';
  fs.writeFileSync(targetPath, before + separator + after, 'utf8');
  return { action: 'removed', message: 'Block removed' };
}

function syncFile(targetPath, template) {
  // If the target is still a symlink (legacy), remove it first to avoid modifying the source file
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

function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  const isDelete = args.includes('--delete') || args.includes('-d');

  if (isDelete) {
    for (const target of TARGETS) {
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

  if (!fs.existsSync(SOURCE_FILE)) {
    console.error(`Error: Source file not found: ${SOURCE_FILE}`);
    process.exit(1);
  }

  const template = fs.readFileSync(SOURCE_FILE, 'utf8');

  for (const target of TARGETS) {
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
