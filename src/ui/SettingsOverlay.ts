import Phaser from 'phaser';
import { PALETTE } from '../config';
import { AudioManager } from '../managers/AudioManager';
import { SaveManager } from '../managers/SaveManager';
import { INTENSITIES, PROFILES } from '../managers/TrollIntensity';
import { Overlay } from './Overlay';

/**
 * Settings panel shared by the main menu and the in-game pause menu. Every change is saved to
 * LocalStorage and applies right away (the narrator reads the intensity live).
 */
export function openSettingsOverlay(scene: Phaser.Scene, onClose: () => void, onSoundChange?: () => void): Overlay {
  const trollLabel = (): string => `Troll: ${PROFILES[SaveManager.trollIntensity].label.toUpperCase()}`;
  const body = (): string => PROFILES[SaveManager.trollIntensity].description;
  const sfxLabel = (): string => `Sound FX: ${AudioManager.sfxEnabled ? 'ON' : 'OFF'}`;
  const voiceLabel = (): string => `Suara Narator: ${SaveManager.trollSfxEnabled ? 'ON' : 'OFF'}`;
  const overlay = new Overlay(scene, {
    title: 'Settings',
    body: body(),
    buttons: [
      {
        label: trollLabel(),
        fill: PALETTE.pink,
        onClick: () => {
          const i = INTENSITIES.indexOf(SaveManager.trollIntensity);
          SaveManager.setTrollIntensity(INTENSITIES[(i + 1) % INTENSITIES.length]);
          overlay.getButton(0)?.setLabel(trollLabel());
          overlay.setBody(body());
          AudioManager.play('click');
        },
      },
      {
        label: sfxLabel(),
        fill: 0x8fcbff,
        onClick: () => {
          AudioManager.setSfxEnabled(!AudioManager.sfxEnabled);
          overlay.getButton(1)?.setLabel(sfxLabel());
          AudioManager.play('click');
          onSoundChange?.();
        },
      },
      {
        label: voiceLabel(),
        fill: PALETTE.lavender,
        onClick: () => {
          SaveManager.setTrollSfxEnabled(!SaveManager.trollSfxEnabled);
          overlay.getButton(2)?.setLabel(voiceLabel());
          AudioManager.playTroll('blip');
        },
      },
      { label: 'Close', fill: 0xf7b878, onClick: onClose },
    ],
  });
  return overlay;
}
