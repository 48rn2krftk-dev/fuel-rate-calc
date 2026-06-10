import type { AppSettings, SlotData } from "../types";

const SETTINGS_KEY = "hotIdle.settings";
const SLOTS_KEY = "hotIdle.slots";
const MAX_SLOTS = 3;

export function getSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);

  if (!raw) {
    return {
      normFuelPerHour: null,
      theme: "light",
    };
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {
      normFuelPerHour: null,
      theme: "light",
    };
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new Event("hotIdle.settingsChanged"));
}

export function subscribeSettingsChange(callback: () => void) {
  window.addEventListener("hotIdle.settingsChanged", callback);

  return () => {
    window.removeEventListener("hotIdle.settingsChanged", callback);
  };
}

function normalizeSlots(slots: Array<SlotData | null>): Array<SlotData | null> {
  const filledSlots = slots.filter((slot): slot is SlotData => slot !== null);
  const emptyCount = Math.max(0, MAX_SLOTS - filledSlots.length);

  return [...filledSlots, ...Array(emptyCount).fill(null)].slice(0, MAX_SLOTS);
}

export function getSlots(): Array<SlotData | null> {
  const raw = localStorage.getItem(SLOTS_KEY);

  if (!raw) {
    return [null, null, null];
  }

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return normalizeSlots(parsed);
    }

    return [null, null, null];
  } catch {
    return [null, null, null];
  }
}

export function saveSlot(index: number, data: SlotData) {
  const slots = getSlots();
  slots[index] = data;

  localStorage.setItem(SLOTS_KEY, JSON.stringify(normalizeSlots(slots)));
  window.dispatchEvent(new Event("hotIdle.slotsChanged"));
}

export function clearSlot(index: number) {
  const slots = getSlots();
  slots.splice(index, 1);
  slots.push(null);

  localStorage.setItem(SLOTS_KEY, JSON.stringify(normalizeSlots(slots)));
  window.dispatchEvent(new Event("hotIdle.slotsChanged"));
}

export function subscribeSlotsChange(callback: () => void) {
  window.addEventListener("hotIdle.slotsChanged", callback);

  return () => {
    window.removeEventListener("hotIdle.slotsChanged", callback);
  };
}