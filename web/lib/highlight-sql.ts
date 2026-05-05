const SQLITE_KEYWORDS =
  'CURRENT_TIMESTAMP|AUTOINCREMENT|CURRENT_DATE|CURRENT_TIME|MATERIALIZED|TRANSACTION|CONSTRAINT|DEFERRABLE|REFERENCES|EXCLUSIVE|FOLLOWING|GENERATED|IMMEDIATE|INITIALLY|INTERSECT|PARTITION|PRECEDING|RECURSIVE|RETURNING|SAVEPOINT|TEMPORARY|UNBOUNDED|CONFLICT|DATABASE|DEFERRED|DISTINCT|RESTRICT|ROLLBACK|ANALYZE|BETWEEN|CASCADE|COLLATE|CURRENT|DEFAULT|EXCLUDE|EXPLAIN|FOREIGN|INDEXED|INSTEAD|NATURAL|NOTHING|NOTNULL|PRIMARY|REINDEX|RELEASE|REPLACE|TRIGGER|VIRTUAL|WITHOUT|ACTION|ALWAYS|ATTACH|BEFORE|COLUMN|COMMIT|CREATE|DELETE|DETACH|ESCAPE|EXCEPT|EXISTS|FILTER|GROUPS|HAVING|IGNORE|INSERT|ISNULL|OFFSET|OTHERS|PRAGMA|REGEXP|RENAME|SELECT|UNIQUE|UPDATE|VACUUM|VALUES|WINDOW|ABORT|AFTER|ALTER|BEGIN|CHECK|CROSS|FIRST|GROUP|INDEX|INNER|LIMIT|MATCH|NULLS|ORDER|OUTER|QUERY|RAISE|RANGE|RIGHT|TABLE|UNION|USING|WHERE|CASE|CAST|DESC|DROP|EACH|ELSE|FAIL|FROM|FULL|GLOB|INTO|JOIN|LAST|LEFT|LIKE|NULL|OVER|PLAN|ROWS|TEMP|THEN|TIES|VIEW|WHEN|WITH|ADD|ALL|AND|ASC|END|FOR|KEY|NOT|ROW|SET|AS|BY|DO|IF|IN|IS|NO|OF|ON|OR|TO'

const TOKENS = {
  comment: /--[^\n\r]*|\/\*[\s\S]*?\*\//y,
  string: /'(?:''|[^'])*'/y,
  'id-quoted': /"(?:""|[^"])*"|\[(?:[^\]])*\]|`(?:``|[^`]*)`/y,
  'param-named': /[:@$][A-Za-z_][A-Za-z0-9_]*/y,
  'param-qmark': /\?(?:\d+)?/y,
  operator: /\|\||<<|>>|<=|>=|==|!=|<>|[-+*/%&|<>=~]/y,
  punct: /[(),.;]/y,
  keyword: new RegExp(String.raw`\b(?:${SQLITE_KEYWORDS})\b`, 'iy'),
  id: /[A-Za-z_][A-Za-z0-9_$]*/y,
  number: /\b(?:0x[0-9A-Fa-f]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/y,
} as const

type TokenType = keyof typeof TOKENS

const defs =
  (Object.entries(TOKENS) as [TokenType, (typeof TOKENS)[TokenType]][])
    .map(([type, re]) => ({ type, re, hl: new Highlight() }))

export function highlightSQL(elem: HTMLElement | null): (() => void) | void {
  const firstChild = elem?.firstChild
  if (!firstChild || firstChild.nodeType !== Node.TEXT_NODE) return
  const sql = (firstChild as Text).data
  if (!sql) return
  let i = -1
  const cleanups = new Set<{ hl: Highlight; range: Range }>()
  main: while (++i < sql.length) {
    if (sql[i] === ' ' || sql[i] === '\t' || sql[i] === '\n') continue
    for (const { hl, re } of defs) {
      re.lastIndex = i
      const m = re.exec(sql)
      if (!m) continue
      const value = m[0]
      const end = i + value.length
      const range = new Range()
      range.setStart(firstChild, i)
      range.setEnd(firstChild, end)
      hl.add(range)
      cleanups.add({ hl, range })
      i = end - 1
      continue main
    }
  }
  return () => {
    for (const { hl, range } of cleanups) hl.delete(range)
    cleanups.clear()
  }
}

// Setup the style and register the highligths
const css = String.raw
const style = document.createElement('style')
style.innerHTML = css`
  ::highlight(comment) {
    color: #a6acb9;
  }
  ::highlight(string) {
    color: #5c99d6;
  }
  ::highlight(number) {
    color: #c594c5;
  }
  ::highlight(id-quoted) {
    color: #99c794;
  }
  ::highlight(id) {
    color: #5fb4b4;
  }
  ::highlight(param-named) {
    color: #f7f7f7;
  }
  ::highlight(param-qmark) {
    color: #f9ae58;
  }
  ::highlight(operator) {
    color: #f97b58;
  }
  ::highlight(punct) {
    color: #596878;
  }
  ::highlight(keyword) {
    color: #c695c6;
  }
`
// Unused theme colors:
// normal #D8DEE9
// end #F9AE58
// error #EC5F66
// selection --background=#3E4347
// search_match --background=#596673
// option #5FB4B4
// host_remote #A3CE9E
document.head.append(style)

for (const { hl, type } of defs) CSS.highlights.set(type, hl)
