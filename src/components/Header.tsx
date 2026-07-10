export function Header() {
  return (
    <header className="header">
      <h1>Color Influence Finder</h1>
      <p className="subtitle">
        Find surrounding colors that make selected qualities appear stronger or weaker in
        your target colors.
      </p>
      <p className="note">
        Color perception is contextual. Results are approximate and may vary by display,
        lighting, color size, and viewing conditions.
      </p>

      <details className="how-it-works">
        <summary>How this works &amp; limitations</summary>
        <ul>
          <li>
            Your target color is never mathematically changed. This tool predicts how
            colors placed <em>next to</em> it may change how it is perceived
            (simultaneous color contrast).
          </li>
          <li>
            Suggestions are scored with heuristics in the OKLCH perceptual color space.
            They are logical and consistent, but they are estimates — not a full model of
            human vision.
          </li>
          <li>
            Actual results depend on monitor calibration, ambient lighting, swatch size,
            spacing, and the viewer. Different people may perceive the effect
            differently.
          </li>
          <li>
            A requested effect may be weak when the target barely contains the quality
            involved (for example, &ldquo;less blue&rdquo; on an orange, or &ldquo;more
            vivid&rdquo; on a pure gray). Low-confidence results say so.
          </li>
          <li>
            Multiple requested effects can conflict. Shared-mode results are the best
            available compromises, not guaranteed solutions, and the app tells you when
            no single surround satisfies every request.
          </li>
        </ul>
      </details>
    </header>
  );
}
