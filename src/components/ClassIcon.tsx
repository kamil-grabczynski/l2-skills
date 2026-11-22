import { useState } from "react";
import { classIconUrl, skillIconUrl } from "../lib/data";

export function ClassIcon({ icon, size }: { icon?: string; size: "sm" | "lg" }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className={`cls-icon cls-icon-${size}`}>
      {icon && !broken && <img alt="" src={classIconUrl(icon)} onError={() => setBroken(true)} />}
    </span>
  );
}

export function SkillIcon({ file }: { file: string }) {
  const [broken, setBroken] = useState(false);
  return file && !broken ? (
    <img className="icon" alt="" loading="lazy" decoding="async" src={skillIconUrl(file)} onError={() => setBroken(true)} />
  ) : (
    <span className="icon" />
  );
}
