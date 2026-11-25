export const htmlRules = [
  {
    id: "html-img-alt",
    severity: "medium",
    pattern: /<img(?![^>]*\balt=)[^>]*>/i,
    message: "Image tag missing alt attribute for accessibility and fallback."
  },
  {
    id: "html-blank-noopener",
    severity: "medium",
    pattern: /<a[^>]*target=["']_blank["'](?![^>]*rel=)[^>]*>/i,
    message: "target='_blank' link missing rel='noopener noreferrer'."
  },
  {
    id: "html-inline-event",
    severity: "low",
    pattern: /\son(click|load|error|mouseover)\s*=/i,
    message: "Inline DOM event handler detected; prefer modular JS event binding."
  }
];
