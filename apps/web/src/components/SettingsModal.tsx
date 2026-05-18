import { Dialog } from "@base-ui/react/dialog";
import { Slider } from "@base-ui/react/slider";
import { X } from "lucide-react";
import type { PieceEdgeSettings } from "../hooks/useSettings";
import styles from "./SettingsModal.module.css";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: PieceEdgeSettings;
  onChange: <K extends keyof PieceEdgeSettings>(key: K, value: number) => void;
  onReset: () => void;
};

type Row = {
  key: keyof PieceEdgeSettings;
  label: string;
  hint: string;
};

const ROWS: Row[] = [
  {
    key: "edgeOpacityLocked",
    label: "はまっているピースの縁取り",
    hint: "所定の位置にロックされたピースの輪郭の濃さ",
  },
  {
    key: "edgeOpacityUnlocked",
    label: "はまっていないピースの縁取り",
    hint: "盤面上を動かせるピースの輪郭の濃さ",
  },
  {
    key: "edgeOpacitySelected",
    label: "選択中のピースの縁取り",
    hint: "クリック・ドラッグで選択したピースの輪郭の濃さ",
  },
];

export function SettingsModal({ open, onOpenChange, settings, onChange, onReset }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className={styles.backdrop} />
        <Dialog.Popup className={styles.popup}>
          <header className={styles.header}>
            <Dialog.Title className={styles.title}>表示設定</Dialog.Title>
            <Dialog.Close className={styles.closeBtn} aria-label="閉じる">
              <X size={16} />
            </Dialog.Close>
          </header>

          <div className={styles.body}>
            {ROWS.map((row) => (
              <OpacitySlider
                key={row.key}
                label={row.label}
                hint={row.hint}
                value={settings[row.key]}
                onValueChange={(v) => onChange(row.key, v)}
              />
            ))}
          </div>

          <footer className={styles.footer}>
            <button type="button" className={styles.resetBtn} onClick={onReset}>
              既定値に戻す
            </button>
            <Dialog.Close className={styles.doneBtn}>完了</Dialog.Close>
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function OpacitySlider({
  label,
  hint,
  value,
  onValueChange,
}: {
  label: string;
  hint: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <section className={styles.section}>
      <Slider.Root
        value={value}
        onValueChange={(v) => onValueChange(v)}
        min={0}
        max={1}
        step={0.01}
      >
        <div className={styles.sectionHeader}>
          <Slider.Label className={styles.label}>{label}</Slider.Label>
          <Slider.Value className={styles.value}>
            {(_formatted, values) => `${Math.round((values[0] ?? 0) * 100)}%`}
          </Slider.Value>
        </div>
        <p className={styles.hint}>{hint}</p>
        <Slider.Control className={styles.slider}>
          <Slider.Track className={styles.sliderTrack}>
            <Slider.Indicator className={styles.sliderIndicator} />
            <Slider.Thumb className={styles.sliderThumb} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
    </section>
  );
}
