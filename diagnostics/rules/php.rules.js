export const phpRules = [
  {
    id: "PHP-RCE-01",
    language: "php",
    severity: "high",
    pattern: /\b(eval|exec|shell_exec|system|passthru|proc_open|popen)\b/i,
    message: "Avoid dynamic command or code execution functions without strict allowlisting."
  },
  {
    id: "PHP-XSS-02",
    language: "php",
    severity: "medium",
    pattern: /\becho\s+\$_(GET|POST|REQUEST|COOKIE)\b/i,
    message: "Escape user-controlled superglobal output before rendering in HTML."
  },
  {
    id: "PHP-SQLI-03",
    language: "php",
    severity: "high",
    pattern: /\b(mysqli_query|mysql_query|pg_query)\b/i,
    message: "Verify parameterized prepared statements are used instead of direct SQL concatenation."
  }
];

export default phpRules;