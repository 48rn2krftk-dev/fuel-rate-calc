import { Save, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

  const filledSlotsCount = useMemo(
    () => slots.filter((slot) => slot !== null).length,
    [slots]
  );

  const visibleSlotIndexes = useMemo(() => {
    const indexes = slots
      .map((slot, index) => (slot ? index : null))
      .filter((index): index is number => index !== null);

    if (filledSlotsCount < 3) {
      indexes.push(filledSlotsCount);
    }

    return indexes;
  }, [slots, filledSlotsCount]);

  function createSlotData(): SlotData | null {
    if (!result) return null;

    return {
      ...result,
      title: title.trim() || defaultTitle,
      savedAt: new Date().toISOString(),
    };
  }

  function showMessage(text: string) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 1800);
  }

  function handleOpen() {
    if (!result) return;

    setTitle(defaultTitle);
    setIsOpen(true);
  }

  function handleClose() {
    setIsOpen(false);
  }

  function handleSave(slotIndex: number) {
    const slotData = createSlotData();

    if (!slotData) return;

    const isOverwrite = slots[slotIndex] !== null;

    saveSlot(slotIndex, slotData);
    setIsOpen(false);

    showMessage(
      isOverwrite
        ? `Слот ${slotIndex + 1} перезаписан`
        : `Сохранено в слот ${slotIndex + 1}`
    );
  }

  return (
    <div className="savePanel">
      <button
        className="primaryButton saveButton"
        type="button"
        disabled={!result}
        onClick={handleOpen}
      >
        <Save size={18} />
        Сохранить
      </button>

      {message && <div className="successBox">{message}</div>}

      {isOpen && result && (
        <div className="modalOverlay" onClick={handleClose}>
          <div
            className="modalSheet"
            role="dialog"
            aria-modal="true"
            aria-label="Сохранение результата"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modalHeader">
              <div>
                <h2>Сохранить результат</h2>
                <p>
                  {filledSlotsCount === 0
                    ? "Задай название и сохрани первый слот."
                    : "Можно перезаписать существующий слот или сохранить в новый."}
                </p>
              </div>

              <button
                className="iconButton"
                type="button"
                onClick={handleClose}
                aria-label="Закрыть"
              >
                <X size={20} />
              </button>
            </div>

            <label className="field">
              <span>Название сохранения</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Например 3ТЭ25К2М-697 секция 1"
                autoFocus
              />
            </label>

            {filledSlotsCount === 0 ? (
              <button
                className="primaryButton fullWidthButton"
                type="button"
                onClick={() => handleSave(0)}
              >
                Сохранить в слот 1
              </button>
            ) : (
              <div className="slotList">
                {visibleSlotIndexes.map((index) => {
                  const slot = slots[index];

                  return (
                    <button
                      key={index}
                      className="slotButton"
                      type="button"
                      onClick={() => handleSave(index)}
                    >
                      <span className="slotButtonTitle">
                        {slot
                          ? `Слот ${index + 1} — перезаписать`
                          : `Слот ${index + 1} — сохранить в новый`}
                      </span>

                      {slot ? (
                        <span className="slotButtonMeta">
                          Сейчас: {slot.title} · {formatTime(slot.minutes)} ·{" "}
                          {formatNumber(slot.fuelPerHour)} кг/ч
                        </span>
                      ) : (
                        <span className="slotButtonMeta">
                          Новый свободный слот
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
