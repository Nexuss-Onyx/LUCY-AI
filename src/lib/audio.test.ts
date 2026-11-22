import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeRmsAmplitude,
  downsampleFloat32,
  float32ToPcm16Base64,
  pcm16Base64ToFloat32,
} from './audio';

test('PCM-16 base64 round-trip preserves waveform values within quantization tolerance', () => {
  const input = new Float32Array([0, 0.5, -0.5, 1, -1, 0.25]);
  const encoded = float32ToPcm16Base64(input);
  const decoded = pcm16Base64ToFloat32(encoded);

  assert.equal(decoded.length, input.length);
  for (let i = 0; i < input.length; i++) {
    assert.ok(Math.abs(decoded[i] - input[i]) < 0.001, `Sample ${i} mismatch`);
  }
});

test('downsampleFloat32 converts 48kHz to 16kHz at 3:1 ratio', () => {
  const input = new Float32Array(480);
  for (let i = 0; i < input.length; i++) {
    input[i] = Math.sin((i / 480) * Math.PI * 2);
  }
  const downsampled = downsampleFloat32(input, 48000, 16000);
  assert.equal(downsampled.length, 160);
});

test('computeRmsAmplitude returns bounded [0, 1] energy', () => {
  assert.equal(computeRmsAmplitude(new Float32Array([])), 0);
  assert.equal(computeRmsAmplitude(new Float32Array([0, 0, 0])), 0);
  const fullScale = computeRmsAmplitude(new Float32Array([1, -1, 1, -1]));
  assert.ok(fullScale > 0.99 && fullScale <= 1);
});
