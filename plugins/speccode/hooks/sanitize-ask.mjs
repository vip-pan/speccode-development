#!/usr/bin/env node
// PreToolUse hook: strip CR from AskUserQuestion tool_input before execution.
// Fail-open: any error exits 0 with no output so the original input passes through.
import { readFileSync } from 'node:fs';
import { stripCR } from '../lib/sanitize.mjs';

try {
  const payload = JSON.parse(readFileSync(0, 'utf8'));
  if (payload?.tool_name === 'AskUserQuestion' && payload.tool_input != null) {
    const cleaned = stripCR(payload.tool_input);
    if (cleaned !== payload.tool_input) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
          updatedInput: cleaned,
        },
      }));
    }
  }
} catch {
  // fail-open
}
