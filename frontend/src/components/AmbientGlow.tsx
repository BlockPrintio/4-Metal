export function AmbientGlow() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        background:
          "radial-gradient(600px 400px at 30% 20%, oklch(0.78 0.13 85 / 0.15), transparent 60%), radial-gradient(500px 350px at 75% 80%, oklch(0.85 0.01 260 / 0.10), transparent 60%)",
      }}
    />
  );
}
