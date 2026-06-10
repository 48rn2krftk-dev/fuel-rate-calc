export type CalculationResult = {
  minutes: number;
  fuelUsed: number;
  fuelPerHour: number;
};

export type SlotData = CalculationResult & {
  title: string;
  savedAt: string;
};

export type AppSettings = {
  normFuelPerHour: number | null;
  theme: "light" | "dark";
};