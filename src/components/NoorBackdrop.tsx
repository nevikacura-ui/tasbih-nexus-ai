export function NoorBackdrop() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-32 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-noor blur-2xl" />
      <svg
        className="absolute inset-x-0 top-0 h-full w-full opacity-[0.06]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern id="geo" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M24 0 L48 24 L24 48 L0 24 Z M24 12 L36 24 L24 36 L12 24 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#geo)" className="text-primary" />
      </svg>
    </div>
  );
}
