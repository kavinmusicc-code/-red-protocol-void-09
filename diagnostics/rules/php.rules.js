export const phpRules = [
  {
    id: "php-short-open",
    severity: "low",
    pattern: /<\?(?!php|=)/m,
    message: "PHP short open tag '<?' found; prefer '<?php' for portability."
  },
  {
    id: "php-raw-echo-input",
    severity: "critical",
    pattern: /\becho\s+\(GET|POST|REQUEST|COOKIE)\b/i,
    message: "Direct output of superglobal input detected; sanitize/escape (XSS risk)."
  },
  {
    id: "php-sql-concat-var",
    severity: "high",
    pattern: /(mysqli_query|query)\s*\(\s*[^,]+,\s*["'][^"']*\(GET|POST|REQUEST)/i,
    message: "User input interpolated directly into SQL query; use prepared statements."
  }
];
