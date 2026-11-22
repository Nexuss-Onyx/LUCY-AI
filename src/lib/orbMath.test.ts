import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCircularMorphRadius,
  computePhaseSpeed,
  mapRmsToVoiceEnergy,
} from './orbMath';

test('mapRmsToVoiceEnergy gates ambient silence and scales monotonically with speech strength', () => {
  assert.equal(mapRmsToVoiceEnergy(0), 0);
  assert.equal(mapRmsToVoiceEnergy(0.004), 0);

  const softSpeech = mapRmsToVoiceEnergy(0.03);
  const mediumSpeech = mapRmsToVoiceEnergy(0.1);
  const loudSpeech = mapRmsToVoiceEnergy(0.25);

  assert.ok(softSpeech > 0.1 && softSpeech < mediumSpeech);
  assert.ok(mediumSpeech < loudSpeech);
  assert.ok(loudSpeech <= 1);
});

test('computeCircularMorphRadius is seamless at 0 and 2π and scales displacement with energy', () => {
  const baseRadius = 110;
  const phase = 1.4;

  const rStart = computeCircularMorphRadius({
    baseRadius,
    angle: 0,
    phase,
    energy: 0.8,
  });
  const rEnd = computeCircularMorphRadius({
    baseRadius,
    angle: Math.PI * 2,
    phase,
    energy: 0.8,
  });
  assert.ok(Math.abs(rStart - rEnd) < 1e-9, 'Contour must close seamlessly at 2π');

  // Measure peak deviation from baseRadius across samples for calm vs loud voice
  let maxCalmDelta = 0;
  let maxLoudDelta = 0;
  for (let i = 0; i < 36; i++) {
    const angle = (i / 36) * Math.PI * 2;
    const calmR = computeCircularMorphRadius({ baseRadius, angle, phase, energy: 0 });
    const loudR = computeCircularMorphRadius({ baseRadius, angle, phase, energy: 0.9 });
    maxCalmDelta = Math.max(maxCalmDelta, Math.abs(calmR - baseRadius));
    maxLoudDelta = Math.max(maxLoudDelta, Math.abs(loudR - baseRadius));
  }

  assert.ok(maxCalmDelta < 3, 'Idle/silent state stays calm and near-circular');
  assert.ok(
    maxLoudDelta > maxCalmDelta * 4,
    'Loud speech drives substantially larger circular wavelength morphing',
  );
});

test('computePhaseSpeed increases with vocal energy during listening and speaking', () => {
  const calmSpeed = computePhaseSpeed('idle', 0);
  const silentListen = computePhaseSpeed('listening', 0);
  const strongListen = computePhaseSpeed('listening', 0.85);
  const strongSpeak = computePhaseSpeed('speaking', 0.9);

  assert.ok(calmSpeed <= silentListen);
  assert.ok(strongListen > calmSpeed * 4);
  assert.ok(strongSpeak > calmSpeed * 4);
});
