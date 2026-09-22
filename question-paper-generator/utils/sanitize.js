import ApiError from './ApiError.js';
export function rejectUnsafeKeys(value, depth = 0) {
  if (depth > 20) throw new ApiError(400, 'Input nesting is too deep');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.') || ['__proto__', 'prototype', 'constructor'].includes(key)) throw new ApiError(400, 'Invalid input key');
    rejectUnsafeKeys(child, depth + 1);
  }
}
export const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const normalizeText = text => text.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[ \t]+/g, ' ').trim();
