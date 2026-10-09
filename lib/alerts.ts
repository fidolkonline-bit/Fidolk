import type { Alert } from "./types";
type AlertUser = { id: string; permissions: readonly string[] };
export function canAcknowledgeAlert(alert: Alert, user: AlertUser) {
  return (
    user.permissions.includes("*") ||
    user.permissions.includes("alerts.manage") ||
    (user.permissions.includes("alerts.view") &&
      (!alert.assigneeUserId || alert.assigneeUserId === user.id))
  );
}
export function needsAlertResponse(alert: Alert, now: number) {
  return (
    !["Acknowledged", "Collected", "Cancelled"].includes(alert.status) &&
    (alert.status === "Due" ||
      alert.status === "Escalated" ||
      now >= Date.parse(alert.dueAt) - alert.minutesBefore * 60000)
  );
}
export function shouldAlarm(alert: Alert, user: AlertUser, now: number) {
  if (!needsAlertResponse(alert, now) || !canAcknowledgeAlert(alert, user))
    return false;
  if (!alert.assigneeUserId || alert.assigneeUserId === user.id) return true;
  return (
    (user.permissions.includes("*") ||
      user.permissions.includes("alerts.manage")) &&
    (alert.status === "Escalated" || now >= Date.parse(alert.dueAt))
  );
}
/** A continuous audio graph: no timer scheduling gaps between tones. */
export function startAlarm(context: AudioContext, volume: number) {
  const tone = context.createOscillator();
  const pulse = context.createOscillator();
  const pulseGain = context.createGain();
  const output = context.createGain();
  tone.type = "sine";
  tone.frequency.value = 780;
  pulse.type = "sine";
  pulse.frequency.value = 2.5;
  pulseGain.gain.value = Math.max(0, Math.min(1, volume)) * 0.1;
  output.gain.value = Math.max(0, Math.min(1, volume)) * 0.12;
  pulse.connect(pulseGain);
  pulseGain.connect(output.gain);
  tone.connect(output);
  output.connect(context.destination);
  tone.start();
  pulse.start();
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    tone.stop();
    pulse.stop();
    tone.disconnect();
    pulse.disconnect();
    pulseGain.disconnect();
    output.disconnect();
  };
}
export type AlertSound = "chime" | "ping" | "beep";
export const ALERT_SOUNDS: {
  value: AlertSound;
  label: string;
  hint: string;
}[] = [
  { value: "chime", label: "Chime", hint: "Two soft notes, like a phone" },
  { value: "ping", label: "Soft ping", hint: "One quiet note" },
  { value: "beep", label: "Classic beep", hint: "Loud and nonstop" },
];
/** A bell-like note: a quick strike that fades, not a flat beep. */
function note(
  context: AudioContext,
  frequency: number,
  at: number,
  level: number,
  length: number,
) {
  const output = context.createGain();
  output.gain.setValueAtTime(0, at);
  output.gain.linearRampToValueAtTime(level, at + 0.008);
  output.gain.exponentialRampToValueAtTime(0.0001, at + length);
  output.connect(context.destination);
  // A quiet overtone gives the note its ring.
  for (const [multiple, gain] of [
    [1, 1],
    [2.76, 0.12],
  ]) {
    const tone = context.createOscillator();
    const partial = context.createGain();
    tone.type = "sine";
    tone.frequency.value = frequency * multiple;
    partial.gain.value = gain;
    tone.connect(partial);
    partial.connect(output);
    tone.start(at);
    tone.stop(at + length + 0.05);
    tone.onended = () => {
      tone.disconnect();
      partial.disconnect();
      output.disconnect();
    };
  }
}
/** Play the sound once, e.g. for a Test button. */
export function playSound(
  context: AudioContext,
  sound: AlertSound,
  volume: number,
) {
  const level = Math.max(0, Math.min(1, volume)) * 0.35;
  const at = context.currentTime + 0.02;
  if (sound === "beep") {
    const stop = startAlarm(context, volume);
    setTimeout(stop, 1500);
  } else if (sound === "ping") note(context, 1174.66, at, level, 0.6);
  else {
    // A5 then E6: a bright, friendly rising pair.
    note(context, 880, at, level, 0.9);
    note(context, 1318.5, at + 0.16, level, 0.9);
  }
}
/** Keep sounding until stopped: the beep nonstop, the others every few seconds. */
export function startSound(
  context: AudioContext,
  sound: AlertSound,
  volume: number,
  everyMs = 4000,
) {
  if (sound === "beep") return startAlarm(context, volume);
  playSound(context, sound, volume);
  const timer = setInterval(() => playSound(context, sound, volume), everyMs);
  return () => clearInterval(timer);
}
