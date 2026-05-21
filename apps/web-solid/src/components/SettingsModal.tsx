import { For } from "solid-js";
import { Dialog, Slider } from "@ark-ui/solid";
import { Portal } from "solid-js/web";
import { X } from "lucide-solid";
import type { PieceEdgeSettings } from "../hooks/useSettings";
import {
  backdrop,
  body,
  closeBtn,
  doneBtn,
  footer,
  header,
  hint,
  labelCls,
  popup,
  positioner,
  resetBtn,
  section,
  sectionHeader,
  slider,
  sliderRange,
  sliderThumb,
  sliderTrack,
  title,
  valueCls,
} from "./SettingsModal.styles";

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

export function SettingsModal(props: Props) {
  return (
    <Dialog.Root
      open={props.open}
      onOpenChange={(d) => props.onOpenChange(d.open)}
    >
      <Portal>
        <Dialog.Backdrop class={backdrop} />
        <Dialog.Positioner class={positioner}>
          <Dialog.Content class={popup}>
            <header class={header}>
              <Dialog.Title class={title}>表示設定</Dialog.Title>
              <Dialog.CloseTrigger class={closeBtn} aria-label="閉じる">
                <X size={16} />
              </Dialog.CloseTrigger>
            </header>

            <div class={body}>
              <For each={ROWS}>
                {(row) => (
                  <OpacitySlider
                    label={row.label}
                    hint={row.hint}
                    value={props.settings[row.key]}
                    onValueChange={(v) => props.onChange(row.key, v)}
                  />
                )}
              </For>
            </div>

            <footer class={footer}>
              <button
                type="button"
                class={resetBtn}
                onClick={props.onReset}
              >
                既定値に戻す
              </button>
              <Dialog.CloseTrigger class={doneBtn}>完了</Dialog.CloseTrigger>
            </footer>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function OpacitySlider(props: {
  label: string;
  hint: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <section class={section}>
      <Slider.Root
        value={[props.value]}
        onValueChange={(details) => {
          const v = details.value[0];
          if (typeof v === "number") props.onValueChange(v);
        }}
        min={0}
        max={1}
        step={0.01}
      >
        <div class={sectionHeader}>
          <Slider.Label class={labelCls}>{props.label}</Slider.Label>
          <Slider.ValueText class={valueCls}>
            {`${Math.round(props.value * 100)}%`}
          </Slider.ValueText>
        </div>
        <p class={hint}>{props.hint}</p>
        <Slider.Control class={slider}>
          <Slider.Track class={sliderTrack}>
            <Slider.Range class={sliderRange} />
          </Slider.Track>
          <Slider.Thumb class={sliderThumb} index={0}>
            <Slider.HiddenInput />
          </Slider.Thumb>
        </Slider.Control>
      </Slider.Root>
    </section>
  );
}
