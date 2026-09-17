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
    !["Acknowledged", "Cancelled"].includes(alert.status) &&
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
