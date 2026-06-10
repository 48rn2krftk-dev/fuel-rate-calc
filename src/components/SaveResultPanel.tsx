import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { CalculationResult, SlotData } from "../types";
import { formatNumber, formatTime } from "../utils/format";
import { getSlots, saveSlot, subscribeSlotsChange } from "../utils/storage";

type SaveResultPanelProps = {
  result: CalculationResult | null;
  defaultTitle: string;
};

export function SaveResultPanel({
  result,
  defaultTitle,
}: SaveResultPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [slots, setSlots] = useState<Array<SlotData | null>>(() => getSlots());
  const [title, setTitle] = useState(defaultTitle);
  const [message, setMessage] = useState("");

  useEffect(() => {
    return subscribeSlotsChange(() => {
      setSlots(getSlots());
    });
  }, []);

  useEffect(() => {
    setTitle(defaultTitle);
  }, [defaultTitle]);

  function handleSave(slotIndex: number) {
    if (!result) return;

    const slotData: SlotData = {
      ...result,
      title: title.trim() || defaultTitle,
      savedAt: new Date().toISOString(),
    };

    saveSlot(slotIndex, slotData);
    setMessage(`Сохранено в слот ${slotIndex + 1}`);
    setIsOpen(false);

    window.setTimeout(() => {
      setMessage("");
    }, 1800);
  }

  return (
    <div className="savePanel">
      <button
        className="primaryButton saveButton"
        type="button"
        disabled={!result}
        onClick={() => setIsOpen((value) => !value)}
      >
        <Save size={18} />
        Сохранить
      </button>

      {message && <div className="successBox">{message}</div>}

      {isOpen && result && (
        <div className="saveDialog">
          <label className="field">
            <span>Название сохранения</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Например 3ТЭ25К2М-697 секция 1"
            />
          </label>

          <div className="slotList">
            {slots.map((slot, index) => (
              <button
                key={index}
                className="slotButton"
                type="button"
                onClick={() => handleSave(index)}
              >
                <span className="slotButtonTitle">Слот {index + 1}</span>

                {slot ? (
                  <span className="slotButtonMeta">
                    {slot.title} · {formatTime(slot.minutes)} ·{" "}
                    {formatNumber(slot.fuelPerHour)} кг/ч
                  </span>
                ) : (
                  <span className="slotButtonMeta">Пустой</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}