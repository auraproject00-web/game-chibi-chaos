import Phaser from 'phaser';
import { PALETTE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { SaveManager } from '../managers/SaveManager';
import { INTENSITIES, PROFILES } from '../managers/TrollIntensity';
import { Overlay } from './Overlay';

const VOLUME_STEPS = [0.2, 0.4, 0.6, 0.8, 1];

function nextVolume(v: number): number {
  const i = VOLUME_STEPS.findIndex((s) => s > v + 0.001);
  return i === -1 ? VOLUME_STEPS[0] : VOLUME_STEPS[i];
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const onOff = (on: boolean): string => (on ? 'ON' : 'OFF');

/**
 * Settings panel shared by the main menu and the in-game pause menu. Every change is saved to
 * LocalStorage and applies right away (music, volumes and the narrator are all read live).
 */
export function openSettingsOverlay(scene: Phaser.Scene, onClose: () => void, onSoundChange?: () => void): Overlay {
  const body = (): string => {
    const p = PROFILES[SaveManager.trollIntensity];
    return `Troll ${p.label}: ${p.description}`;
  };
  const labels = [
    (): string => `Musik: ${onOff(AudioManager.musicEnabled)}`,
    (): string => `Vol Musik: ${pct(AudioManager.musicVolume)}`,
    (): string => `SFX: ${onOff(AudioManager.sfxEnabled)}`,
    (): string => `Vol SFX: ${pct(AudioManager.sfxVolume)}`,
    (): string => `Troll: ${PROFILES[SaveManager.trollIntensity].label.toUpperCase()}`,
    (): string => `Suara Narator: ${onOff(SaveManager.trollSfxEnabled)}`,
  ];
  const refresh = (): void => {
    labels.forEach((l, i) => overlay.getButton(i)?.setLabel(l()));
    overlay.setBody(body());
    onSoundChange?.();
  };
  const actions = [
    (): void => AudioManager.setMusicEnabled(!AudioManager.musicEnabled),
    (): void => {
      AudioManager.setMusicVolume(nextVolume(AudioManager.musicVolume));
      if (!AudioManager.musicEnabled) AudioManager.setMusicEnabled(true);
    },
    (): void => AudioManager.setSfxEnabled(!AudioManager.sfxEnabled),
    (): void => {
      AudioManager.setSfxVolume(nextVolume(AudioManager.sfxVolume));
      if (!AudioManager.sfxEnabled) AudioManager.setSfxEnabled(true);
    },
    (): void => {
      const i = INTENSITIES.indexOf(SaveManager.trollIntensity);
      SaveManager.setTrollIntensity(INTENSITIES[(i + 1) % INTENSITIES.length]);
    },
    (): void => {
      SaveManager.setTrollSfxEnabled(!SaveManager.trollSfxEnabled);
      // Preview the narrator sound of the current mode when it is switched on.
      const pool = PROFILES[SaveManager.trollIntensity].popupSfx;
      AudioManager.playTroll(pool[0]);
    },
  ];
  const fills = [PALETTE.mint, PALETTE.mint, 0x8fcbff, 0x8fcbff, PALETTE.pink, PALETTE.lavender];
  const overlay = new Overlay(scene, {
    title: 'Settings',
    body: body(),
    columns: 2,
    buttons: [
      ...labels.map((l, i) => ({
        label: l(),
        fill: fills[i],
        onClick: () => {
          actions[i]();
          refresh();
        },
      })),
      { label: 'Close', fill: 0xf7b878, onClick: onClose },
    ],
  });
  return overlay;
}
