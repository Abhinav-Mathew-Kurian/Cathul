// Small hand-coded SVG decorations matching the coastal/tropical reference
// design — no external illustration assets needed for the site chrome.

export function HeartIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 20.5s-7.5-4.6-10-9.3C.4 7.9 2 4.5 5.3 4c2.1-.3 4 .8 5 2.6C11.3 4.8 13.2 3.7 15.3 4c3.3.5 4.9 3.9 3.3 7.2-2.5 4.7-10 9.3-10 9.3z" />
    </svg>
  );
}

// Palm tree glyph from Material Design Icons (Apache-2.0) via api.iconify.design.
export function PalmFrond({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="var(--palm)" aria-hidden>
      <path d="M12 9c1.59 7.61-2 13-2 13h3c1.88-5.8 1-9.91.5-12m2.16-2.84c.17.21.34.43.47.66a7.1 7.1 0 0 1-.63 8.44a7.11 7.11 0 0 0-.55-6.49c-.08-.13-.17-.24-.25-.36a7.1 7.1 0 0 0-2.16-1.98a7.13 7.13 0 0 0-4.96 6.79c0 .74.11 1.45.31 2.11a7.07 7.07 0 0 1-1.33-4.14c0-2.35 1.14-4.43 2.89-5.73C8 6.35 6.46 6.67 5.12 7.5q-.93.615-1.62 1.41C4.05 7.58 5 6.39 6.3 5.57c1.5-.94 3.2-1.25 4.84-1.01C10.73 4 10.23 3.47 9.63 3c-.58-.42-1.21-.76-1.87-1c1.44.04 2.88.5 4.11 1.43c.63.47 1.13 1.04 1.53 1.64c.1 0 .19-.01.29-.01c3.2 0 5.91 2.11 6.81 5.02a7.07 7.07 0 0 0-4.84-2.92" />
    </svg>
  );
}

export function WaveDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 40"
      className={className}
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
    >
      <path
        d="M0 20C40 5 80 5 120 20S200 35 240 20 320 5 360 20 400 20 400 20V40H0V20Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function CallIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8z" />
    </svg>
  );
}

export function CameraIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="14" r="3.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden>
      <path d="M12 2a7 7 0 00-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 00-7-7zm0 9.5A2.5 2.5 0 1112 6.5a2.5 2.5 0 010 5z" />
    </svg>
  );
}

export function LeafSprig({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 24" className={className} fill="none" aria-hidden>
      <path d="M2 12h50" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {[10, 22, 34, 46].map((x, i) => (
        <path
          key={x}
          d={`M${x} 12c3-4 6-4 8-1.5`}
          stroke="currentColor"
          strokeWidth="1"
          strokeLinecap="round"
          transform={i % 2 === 1 ? `rotate(180 ${x + 4} 12)` : undefined}
        />
      ))}
    </svg>
  );
}

export function BirdFlock({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 20" className={className} fill="none" aria-hidden>
      {[
        [2, 10],
        [14, 4],
        [24, 12],
        [36, 2],
        [46, 9],
      ].map(([x, y]) => (
        <path
          key={x}
          d={`M${x} ${y}c2-3 4-3 5 0c1-3 3-3 5 0`}
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}

export function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect x="3.5" y="5" width="17" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
