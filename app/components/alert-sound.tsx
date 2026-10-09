"use client";

import { useSyncExternalStore } from "react";
import { Volume2 } from "lucide-react";
import { ALERT_SOUNDS, playSound, type AlertSound } from "@/lib/alerts";
import styles from "./alert-sound.module.css";

// Each computer keeps its own choice; it is a preference, not shop data.
const KEY = "fido-alert-sound";
const CHANGED = "fido-alert-sound-changed";
const DEFAULT: AlertSound = "chime";

function read(): AlertSound {
  try {
    const value = localStorage.getItem(KEY);
    return ALERT_SOUNDS.some((s) => s.value === value)
      ? (value as AlertSound)
      : DEFAULT;
  } catch {
    return DEFAULT;
  }
}
function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGED, onChange);
  };
}
function save(sound: AlertSound) {
  try {
    localStorage.setItem(KEY, sound);
  } catch {
    /* Private windows may block storage; the choice lasts until reload. */
  }
  window.dispatchEvent(new Event(CHANGED));
}

/** The alarm sound chosen on this computer, shared by every alarm. */
export function useAlertSound(): AlertSound {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}

let preview: AudioContext | null = null;
async function test(sound: AlertSound) {
  try {
    if (!preview || preview.state === "closed") preview = new AudioContext();
    await preview.resume();
    playSound(preview, sound, 0.8);
  } catch {
    /* No audio in this browser; the picker still saves the choice. */
  }
}

/** Pick the alarm sound for this computer, with a test button for each. */
export function AlertSoundPicker() {
  const sound = useAlertSound();
  return (
    <div className={styles.picker} role="radiogroup" aria-label="Alarm sound">
      {ALERT_SOUNDS.map((option) => (
        <div
          key={option.value}
          className={`${styles.option} ${sound === option.value ? styles.on : ""}`}
        >
          <button
            type="button"
            role="radio"
            aria-checked={sound === option.value}
            className={styles.choose}
            onClick={() => {
              save(option.value);
              void test(option.value);
            }}
          >
            <strong>{option.label}</strong>
            <small>{option.hint}</small>
          </button>
          <button
            type="button"
            className={styles.play}
            aria-label={`Play ${option.label}`}
            onClick={() => void test(option.value)}
          >
            <Volume2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}
