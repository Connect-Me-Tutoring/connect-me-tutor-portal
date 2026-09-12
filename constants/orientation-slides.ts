/** Approved, non-hidden slides from the Connect Me orientation deck. */
const SLIDE_COUNT = 21;
const SLIDE_CACHE_VERSIONS: Readonly<Partial<Record<number, number>>> = { 9: 2 };

export const ORIENTATION_SLIDES = Array.from({ length: SLIDE_COUNT }, (_, index) => {
  const slideNumber = index + 1;
  const filename = `slide-${String(slideNumber).padStart(2, "0")}.webp`;
  const cacheVersion = SLIDE_CACHE_VERSIONS[slideNumber];

  return `/api/orientation/slides/${filename}${cacheVersion ? `?v=${cacheVersion}` : ""}`;
});
