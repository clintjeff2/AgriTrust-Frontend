/**
 * Lightweight ICU MessageFormat parser + formatter.
 *
 * Supports the subset that the certification dashboard needs:
 *   - simple arguments            {name}
 *   - plural / selectordinal      {count, plural, =0 {…} one {# …} other {# …}}
 *   - select                      {status, select, active {…} other {…}}
 *   - the # token inside plurals  (locale-formatted plural value, minus offset)
 *   - offset                      {count, plural, offset:1 one {…} other {…}}
 *   - ICU apostrophe escaping     '{', '}', '#' and '' -> '
 *
 * Plural category selection and number formatting are delegated to the
 * platform `Intl` APIs, so every supported locale (incl. ar/zh) is handled
 * by CLDR rules without bundling rule tables.
 *
 * Parsing is intentionally lenient: a malformed message degrades to its
 * literal text rather than throwing, which keeps a bad translation from
 * crashing the UI.
 */

export type ICUPrimitive = string | number | boolean | null | undefined;
export type ICUVariables = Record<string, ICUPrimitive>;

type Node =
  | { type: "text"; value: string }
  | { type: "hash" }
  | { type: "arg"; name: string }
  | { type: "select"; name: string; options: Record<string, Node[]> }
  | {
      type: "plural";
      name: string;
      offset: number;
      ordinal: boolean;
      options: Record<string, Node[]>;
    };

class Parser {
  pos = 0;
  private readonly len: number;

  constructor(private readonly msg: string) {
    this.len = msg.length;
  }

  private peek(): string | undefined {
    return this.pos < this.len ? this.msg[this.pos] : undefined;
  }

  private skipWs(): void {
    while (this.pos < this.len && /\s/.test(this.msg[this.pos])) this.pos++;
  }

  /** Match `ch` (after optional whitespace); leniently no-op if absent. */
  private expect(ch: string): void {
    this.skipWs();
    if (this.peek() === ch) this.pos++;
  }

  /** Read an identifier (argument name / keyword): stops at ws , { }. */
  private readName(): string {
    let s = "";
    while (this.pos < this.len && /[^\s,{}]/.test(this.msg[this.pos])) {
      s += this.msg[this.pos++];
    }
    return s;
  }

  /** Read a plural/select selector token: stops at whitespace or `{`. */
  private readSelector(): string {
    let s = "";
    while (
      this.pos < this.len &&
      !/\s/.test(this.msg[this.pos]) &&
      this.msg[this.pos] !== "{"
    ) {
      s += this.msg[this.pos++];
    }
    return s;
  }

  /** Consume through the matching close brace of the current argument. */
  private skipToClose(): void {
    let depth = 1;
    while (this.pos < this.len && depth > 0) {
      const c = this.msg[this.pos++];
      if (c === "{") depth++;
      else if (c === "}") depth--;
    }
  }

  parseNodes(insideArg: boolean): Node[] {
    const nodes: Node[] = [];
    let text = "";
    const flush = () => {
      if (text) {
        nodes.push({ type: "text", value: text });
        text = "";
      }
    };

    while (this.pos < this.len) {
      const ch = this.msg[this.pos];

      if (ch === "}" && insideArg) break;

      if (ch === "'") {
        const next = this.msg[this.pos + 1];
        if (next === "'") {
          text += "'";
          this.pos += 2;
          continue;
        }
        if (next === "{" || next === "}" || next === "#" || next === "|") {
          // Quoted literal: copy verbatim until the closing apostrophe.
          this.pos++;
          while (this.pos < this.len && this.msg[this.pos] !== "'") {
            text += this.msg[this.pos++];
          }
          this.pos++; // closing '
          continue;
        }
        text += "'";
        this.pos++;
        continue;
      }

      if (ch === "#") {
        flush();
        nodes.push({ type: "hash" });
        this.pos++;
        continue;
      }

      if (ch === "{") {
        flush();
        nodes.push(this.parseArgument());
        continue;
      }

      text += ch;
      this.pos++;
    }

    flush();
    return nodes;
  }

  private parseArgument(): Node {
    this.pos++; // consume '{'
    this.skipWs();
    const name = this.readName();
    this.skipWs();

    if (this.peek() === "}") {
      this.pos++;
      return { type: "arg", name };
    }

    if (this.peek() === ",") {
      this.pos++;
      this.skipWs();
      const argType = this.readName();
      this.skipWs();

      if (argType === "plural" || argType === "selectordinal") {
        return this.parsePlural(name, argType === "selectordinal");
      }
      if (argType === "select") {
        return this.parseSelect(name);
      }
      // Unsupported format type (number/date/time/…): treat as plain arg.
      this.skipToClose();
      return { type: "arg", name };
    }

    this.skipToClose();
    return { type: "arg", name };
  }

  private parsePlural(name: string, ordinal: boolean): Node {
    this.expect(",");
    this.skipWs();

    let offset = 0;
    if (this.msg.startsWith("offset:", this.pos)) {
      this.pos += "offset:".length;
      offset = parseInt(this.readName(), 10) || 0;
    }

    const options = this.parseOptions();
    return { type: "plural", name, offset, ordinal, options };
  }

  private parseSelect(name: string): Node {
    this.expect(",");
    const options = this.parseOptions();
    return { type: "select", name, options };
  }

  private parseOptions(): Record<string, Node[]> {
    const options: Record<string, Node[]> = {};
    this.skipWs();
    while (this.pos < this.len && this.peek() !== "}") {
      const selector = this.readSelector();
      this.expect("{");
      const nodes = this.parseNodes(true);
      this.expect("}");
      options[selector] = nodes;
      this.skipWs();
    }
    this.expect("}"); // close the argument itself
    return options;
  }
}

const astCache = new Map<string, Node[]>();

function getAst(message: string): Node[] {
  let ast = astCache.get(message);
  if (!ast) {
    ast = new Parser(message).parseNodes(false);
    astCache.set(message, ast);
  }
  return ast;
}

function formatValue(value: ICUPrimitive, locale: string): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return new Intl.NumberFormat(locale).format(value);
  }
  return String(value);
}

function render(
  nodes: Node[],
  locale: string,
  vars: ICUVariables,
  pluralValue: number | undefined,
): string {
  let out = "";
  for (const node of nodes) {
    switch (node.type) {
      case "text":
        out += node.value;
        break;
      case "hash":
        out +=
          pluralValue === undefined
            ? "#"
            : new Intl.NumberFormat(locale).format(pluralValue);
        break;
      case "arg":
        out += formatValue(vars[node.name], locale);
        break;
      case "select": {
        const key = String(vars[node.name]);
        const branch = node.options[key] ?? node.options.other ?? [];
        out += render(branch, locale, vars, pluralValue);
        break;
      }
      case "plural": {
        const raw = Number(vars[node.name]);
        const value = Number.isFinite(raw) ? raw - node.offset : 0;
        let branch = node.options[`=${raw}`];
        if (!branch) {
          const category = new Intl.PluralRules(locale, {
            type: node.ordinal ? "ordinal" : "cardinal",
          }).select(value);
          branch = node.options[category] ?? node.options.other ?? [];
        }
        out += render(branch, locale, vars, value);
        break;
      }
    }
  }
  return out;
}

/**
 * Format an ICU message string for `locale`, interpolating `vars`.
 * Parsed ASTs are cached, so repeated `t()` calls only pay parse cost once.
 */
export function formatICU(
  message: string,
  locale: string,
  vars: ICUVariables = {},
): string {
  return render(getAst(message), locale, vars, undefined);
}

/** Test/maintenance helper: drop the parsed-AST cache. */
export function clearIcuCache(): void {
  astCache.clear();
}
