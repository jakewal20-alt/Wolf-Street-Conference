import { useEffect, useState, type CSSProperties } from "react";

/**
 * The Wolf Street logo intro, the same one the Wolf Street home page plays
 * (wolfstreet-brand app/src/App.tsx `Intro`): the wolf draws itself in copper,
 * WOLF / STREET rises, the four apps appear, then it fades into the page.
 * Once per browser session; a click or key skips it; never shown to anyone
 * who asks for reduced motion. Styles: `.intro*` in index.css.
 */
const WOLF_PATH =
  "M10.8 1 L24 19.5 L32 23.7 L40 19.5 L53.2 1 L55.2 28.8 L59.3 35.1 L32 63 L4.7 35.1 L8.8 28.8 Z M12.2 8.9 L19.6 18.8 L11.4 23.2 Z M51.8 8.9 L44.4 18.8 L52.6 23.2 Z M13.9 29.8 L28.1 36.3 L20.5 37.4 Z M50.1 29.8 L35.9 36.3 L43.5 37.4 Z M28.1 50.3 L35.9 50.3 L34.4 54.1 L29.6 54.1 Z";
const INTRO_KEY = "ws-intro-seen";
const APPS = [
  { id: "forecast", name: "Forecast" },
  { id: "samklr", name: "SAMklr" },
  { id: "hallway", name: "Hallway" },
  { id: "ghostwriter", name: "Ghostwriter" },
];

export function WolfStreetIntro() {
  const [show, setShow] = useState(() => {
    try {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || sessionStorage.getItem(INTRO_KEY)) return false;
      sessionStorage.setItem(INTRO_KEY, "1");
    } catch {
      return false;
    }
    return true;
  });
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (!show) return;
    const skip = () => setLeaving(true);
    window.addEventListener("keydown", skip);
    return () => window.removeEventListener("keydown", skip);
  }, [show]);

  if (!show) return null;
  return (
    <div
      className={leaving ? "intro intro-skip" : "intro"}
      role="presentation"
      onClick={() => setLeaving(true)}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setShow(false);
      }}
    >
      <svg className="intro-mark" viewBox="-2 -2 68 68" aria-hidden="true">
        <path d={WOLF_PATH} pathLength={1} fillRule="evenodd" />
      </svg>
      <p className="intro-word" aria-label="Wolf Street">
        <span>WOLF</span>
        <span>STREET</span>
      </p>
      <ul className="intro-apps" aria-hidden="true">
        {APPS.map((a, i) => (
          <li key={a.id} className={`app-${a.id}`} style={{ "--i": i } as CSSProperties}>
            {a.name}
          </li>
        ))}
      </ul>
    </div>
  );
}
