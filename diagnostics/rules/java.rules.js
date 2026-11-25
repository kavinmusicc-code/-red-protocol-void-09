export const javaRules = [
  {
    id: "java-empty-catch",
    severity: "high",
    pattern: /catch\s*\([^)]+\)\s*\{\s*\}/m,
    message: "Empty catch block swallows exceptions silently."
  },
  {
    id: "java-string-eq",
    severity: "medium",
    pattern: /"\s*==\s*\w+|\w+\s*==\s*"/m,
    message: "String comparison using '==' checks reference equality; use .equals()."
  },
  {
    id: "java-sysout",
    severity: "low",
    pattern: /\bSystem\.out\.print(ln)?\s*\(/m,
    message: "System.out debug print found; use a proper logger in production."
  }
];
