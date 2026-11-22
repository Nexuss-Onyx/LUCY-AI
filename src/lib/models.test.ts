import test from 'node:test';
import assert from 'node:assert/strict';
import { AMHARIC_STARTER_PROMPTS, LUCY_SYSTEM_INSTRUCTION } from './prompts';

test('LUCY_SYSTEM_INSTRUCTION identifies as Lucy AI, enforces Amharic, and hides model details', () => {
  assert.match(LUCY_SYSTEM_INSTRUCTION, /Lucy AI/);
  assert.match(LUCY_SYSTEM_INSTRUCTION, /Amharic/);
  assert.match(LUCY_SYSTEM_INSTRUCTION, /Never mention underlying model names/);
  assert.doesNotMatch(LUCY_SYSTEM_INSTRUCTION, /Gemini/);
  assert.doesNotMatch(LUCY_SYSTEM_INSTRUCTION, /Elsa/);
});

test('AMHARIC_STARTER_PROMPTS reference Lucy in Amharic', () => {
  assert.ok(AMHARIC_STARTER_PROMPTS.length >= 3);
  assert.match(AMHARIC_STARTER_PROMPTS[0].amharic, /ሉሲ/);
});
