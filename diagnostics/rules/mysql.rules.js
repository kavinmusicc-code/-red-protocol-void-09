export const mysqlRules = [
  {
    id: "sql-select-star",
    severity: "low",
    pattern: /\bSELECT\s+\*\s+FROM\b/i,
    message: "SELECT * fetches unnecessary columns; specify required columns explicitly."
  },
  {
    id: "sql-delete-no-where",
    severity: "critical",
    pattern: /\bDELETE\s+FROM\s+\S+(?![\s\S]*\bWHERE\b)/i,
    message: "DELETE statement without WHERE clause can wipe entire table."
  },
  {
    id: "sql-update-no-where",
    severity: "critical",
    pattern: /\bUPDATE\s+\S+\s+SET\s+[\s\S]+?(?=\bWHERE\b|;|$)/i,
    message: "Verify UPDATE statement includes a restrictive WHERE clause."
  }
];
