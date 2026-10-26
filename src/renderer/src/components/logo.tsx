/** Placeholder mark: the initials of Clean Uniform Neat Torrent on a grey tile, in Geist Mono with the last one in serif italic. */
export const Logo = () => (
  <div
    role="img"
    aria-label="Clean Uniform Neat Torrent"
    className="size-12 shrink-0 rounded-lg border bg-muted font-mono text-lg leading-none font-semibold shadow-raised"
  >
    {/*
      the metal gradient fills the whole tile and is clipped to all four letters at once, so one sheen runs from the top
      left corner to the bottom right; letters in a row share a baseline, so N and T stand on one line whatever the
      metrics of their fonts, and each letter box is trimmed to the capital height, so the empty descender space no
      longer weighs down the bottom
    */}
    <div className="grid size-full grid-cols-[auto_auto] place-content-center items-baseline justify-items-center gap-x-1 gap-y-1 metal-text *:[text-box:trim-both_cap_alphabetic]">
      <span>C</span>
      <span>U</span>
      <span>N</span>
      {/* Newsreader has shorter capitals than Geist Mono, so the T is enlarged until both cap heights match and pulled left against its italic overhang */}
      <span className="-ml-0.5 font-serif text-[1.2rem] italic">T</span>
    </div>
  </div>
)
