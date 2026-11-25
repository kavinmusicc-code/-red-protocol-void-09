export const pythonRules = [
  {
    id: "py-bare-except",
    severity: "high",
    pattern: /^\s*except\s*:/m,
    message: "Bare 'except:' catches system/keyboard interrupts; catch specific exceptions."
  },
  {
    id: "py-mutable-default",
    severity: "high",
    pattern: /def\s+\w+\s*\([^)]*=\s*(\[\]|\{\})/m,
    message: "Mutable default argument ([] or {}) can retain state across calls."
  },
  {
    id: "py-exec-eval",
    severity: "critical",
    pattern: /\b(eval|exec)\s*\(/m,
    message: "Dynamic eval()/exec() detected; high security risk on untrusted input."
  }
];
