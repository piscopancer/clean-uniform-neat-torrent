/** Id of the shared SVG filter that gives icons the same top-lit metal look as the text. */
const metalFilterId = 'metal-shine'

/**
 * White wash over the upper half of a shape, matching the stops of the metal text gradient in index.css: strong at
 * the top, fading towards the middle, gone just below it and faintly back near the bottom.
 */
const shine = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" preserveAspectRatio="none">
    <linearGradient id="g" x2="0" y2="1">
      <stop offset="0.15" stop-color="white" stop-opacity="0.5"/>
      <stop offset="0.46" stop-color="white" stop-opacity="0.28"/>
      <stop offset="0.54" stop-color="white" stop-opacity="0"/>
      <stop offset="0.9" stop-color="white" stop-opacity="0.15"/>
    </linearGradient>
    <rect width="1" height="1" fill="url(#g)"/>
  </svg>`,
)}`

/**
 * Mounted once per window: the filter lays the shine over each icon's own strokes, so an icon keeps its colour and
 * only its upper half lights up. The filter is published as `--metal-filter` for the icon rule in index.css.
 */
export const MetalFilter = () => (
  <svg aria-hidden className="pointer-events-none absolute size-0">
    <filter
      id={metalFilterId}
      primitiveUnits="objectBoundingBox"
      x="0"
      y="0"
      width="1"
      height="1"
      colorInterpolationFilters="sRGB"
    >
      <feImage href={shine} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="shine" />
      <feComposite in="shine" in2="SourceAlpha" operator="in" result="lit" />
      <feMerge>
        <feMergeNode in="SourceGraphic" />
        <feMergeNode in="lit" />
      </feMerge>
    </filter>
    <style>{`:root { --metal-filter: url(#${metalFilterId}); }`}</style>
  </svg>
)
