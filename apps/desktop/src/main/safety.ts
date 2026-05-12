import path from 'node:path';
import os from 'node:os';

const HOME = os.homedir();

const ALLOWED_ROOTS = [
  path.join(HOME, 'Desktop'),
  path.join(HOME, 'Documents'),
  path.join(HOME, 'Downloads'),
  path.join(HOME, 'Pictures'),
];

const BLOCKED_SEGMENTS = [
  'windows',
  'program files',
  'programdata',
  'system32',
  'syswow64',
  'boot',
  'system volume information',
];

const BLOCKED_EXTS = ['.sys', '.dll', '.exe'];

export function validatePath(targetPath: string): { valid: boolean; reason?: string } {
  try {
    const resolved = path.resolve(targetPath);
    const lower = resolved.toLowerCase();

    // 1. Must be within allowed roots
    const isAllowed = ALLOWED_ROOTS.some((root) => lower.startsWith(root.toLowerCase()));
    if (!isAllowed) {
      return { valid: false, reason: `Path ${resolved} is outside allowed directories` };
    }

    // 2. Must NOT contain blocked system segments
    const isBlocked = BLOCKED_SEGMENTS.some((seg) => lower.includes(seg));
    if (isBlocked) {
      return { valid: false, reason: `Path ${resolved} contains a protected system directory` };
    }

    // 3. Must NOT be a system file extension in system paths
    const ext = path.extname(resolved).toLowerCase();
    if (BLOCKED_EXTS.includes(ext)) {
      return { valid: false, reason: `File extension ${ext} is blocked for safety` };
    }

    return { valid: true };
  } catch (err) {
    return { valid: false, reason: `Invalid path: ${err instanceof Error ? err.message : 'unknown'}` };
  }
}

export function getAllowedRoots(): string[] {
  return ALLOWED_ROOTS;
}
