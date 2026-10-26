export const coatColors = ["#ef805f", "#a9cfbd", "#e8be69", "#b3a1c9", "#80a5c6", "#df9baf", "#91ab77", "#c6b5a0"];
export const coatNames = ["Ember", "Sage", "Saffron", "Lilac", "Storm", "Rose", "Moss", "Stone"];
export type WitnessHat = "none" | "beanie" | "cap" | "headphones";
export interface WitnessProfile { display_name: string; avatar_color: number; hat: WitnessHat }

/** Original cutout witness; the same coat, scarf, and headwear vocabulary is used in Phaser. */
export function WitnessAvatar({ color = 0, hat = "none", className = "", label }: { color?: number; hat?: string; className?: string; label?: string }) {
  return <svg className={`witness-avatar ${className}`} viewBox="0 0 140 180" role={label ? "img" : undefined} aria-label={label} aria-hidden={!label}>
    <ellipse cx="73" cy="166" rx="48" ry="10" fill="#09141b" opacity=".4" />
    <g stroke="#12212a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round">
      <path d="M50 131 46 161 65 161 71 132M79 131 82 161 101 161 96 131" fill="#283844" />
      <path d="M45 155h22v12H39v-6ZM82 155h19l8 12H81Z" fill="#14212a" />
      <path d="m43 73-16 36 11 9 17-25M96 74l17 38-12 7-17-27" fill={coatColors[color % 8]} />
      <path d="m46 69-9 67 27 8 9-13 8 13 25-8-10-67Z" fill={coatColors[color % 8]} />
      <path d="m70 76 3 55M46 116h17M85 116h15" fill="none" strokeOpacity=".45" />
      <path d="m47 69 23 20 26-19-13-9H58Z" fill="#e5c27d" />
      <path d="m70 82 12 1 6 28-13-3Z" fill="#e5c27d" />
      <path d="M44 25q25-19 51 1l5 31q-7 20-28 20T41 56Z" fill="#e9c59b" />
      <path d="M42 43q-6-28 14-31 18-12 38 6l8 27-20-4-4-10-8 12-28 6Z" fill="#21333e" />
      <path d="m47 51 16-2M80 49h12" fill="none" />
      <path d="M69 49v11h6M65 68h14" fill="none" strokeWidth="3" />
      <path d="m97 108 13-1 1 27-18 2Z" fill="#b6bcb0" />
      <path d="m96 117 14-1" stroke="#f1e4c7" />
      <path d="m40 92 15 2-2 16-15-3Z" fill="#f1e4c7" strokeWidth="2" />
      <path d="m42 98 9 1" strokeWidth="2" />
      {hat === "beanie" && <><path d="M39 35q-2-26 28-28 31-2 34 28Z" fill={coatColors[(color + 2) % 8]} /><path d="m38 33 64-1v13l-64 2Z" fill={coatColors[(color + 2) % 8]} /></>}
      {hat === "cap" && <><path d="M40 34q3-29 33-26 26 1 29 28Z" fill="#b2ceba" /><path d="m62 34 51 4-3 10-49-4Z" fill="#b2ceba" /></>}
      {hat === "headphones" && <><path d="M35 48V31q4-24 36-24 31 0 34 24v20" fill="none" stroke="#e7b768" strokeWidth="9" /><rect x="29" y="37" width="15" height="26" rx="5" fill="#405665" /><rect x="99" y="37" width="15" height="26" rx="5" fill="#405665" /></>}
    </g>
  </svg>;
}
