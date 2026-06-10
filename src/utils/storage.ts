import type { AppSettings, SlotData } from "../types";

const SETTINGS_KEY = "hotIdle.settings";
const SLOTS_KEY = "hotIdle.slots";

export function getSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);

  if (!raw) {
    return {
      normFuelPerHour: null,
      theme: "light",
    };
  }

  return JSON.parse(raw);
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

export function getSlots(): Array<SlotData | null> {
  const raw = localStorage.getItem(SLOTS_KEY);

  if (!raw) {
    return [null, null, null];
  }

  return JSON.parse(raw);
}

export function saveSlot(index: number, data: SlotData) {
  const slots = getSlots();
  slots[index] = data;
  localStorage.setItem(SLOTS_KEY, JSON.stringify(slots));
}