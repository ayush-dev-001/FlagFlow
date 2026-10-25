/** The fixed backdrop behind signed-in screens: the home page's lime glows, low enough to work under. */
export function Backdrop() {
  return (
    <div className="backdrop" aria-hidden="true">
      <div className="backdrop-glow -bottom-56 -left-48 size-[520px] bg-lime/[0.13]" />
      <div className="backdrop-glow -right-56 -bottom-64 size-[420px] bg-lime/[0.07]" />
    </div>
  );
}
