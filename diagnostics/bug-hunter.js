import { htmlRules } from "./rules/html.rules.js";
import { pythonRules } from "./rules/python.rules.js";
import { phpRules } from "./rules/php.rules.js";
import { javaRules } from "./rules/java.rules.js";
import { mysqlRules } from "./rules/mysql.rules.js";

const RULE_SETS = {
  html: htmlRules,
  python: pythonRules,
  php: phpRules,
  java: javaRules,
  mysql: mysqlRules
};

export class BugHunter {
  scan(code = "", language = "html") {
    const lang = String(language || "html").toLowerCase();
    const rules = RULE_SETS[lang] || [];
    const source = String(code || "");
    const findings = [];

    for (const rule of rules) {
      if (rule.pattern.test(source)) {
        findings.push({
          ruleId: rule.id,
          severity: rule.severity,
          language: lang,
          message: rule.message
        });
      }
    }

    return {
      language: lang,
      totalIssues: findings.length,
      findings
    };
  }
}

export const bugHunter = new BugHunter();
