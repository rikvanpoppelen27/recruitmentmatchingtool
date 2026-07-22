/**
 * Booleaanse zoekterm-parser + vertaler naar Adzuna-parameters (fase 6B).
 *
 * Grammatica (precedentie NOT > AND > OR, haakjes overschrijven precedentie):
 *   expressie := orExpr
 *   orExpr    := andExpr (OR andExpr)*
 *   andExpr   := notExpr ((AND | ε voor NOT) notExpr)*   -- "react NOT stage"
 *                mag zonder expliciete AND vóór NOT (net als "react AND NOT stage")
 *   notExpr   := NOT primair | primair
 *   primair   := "(" expressie ")" | woord | "woordgroep"
 * NOT mag alleen direct vóór een los woord/woordgroep staan, niet vóór een
 * groep tussen haakjes (bv. "NOT (a OR b)" is niet ondersteund) — dat geeft
 * een duidelijke foutmelding vóór er gezocht wordt.
 *
 * Vertaling naar Adzuna (die geen geneste haakjes ondersteunt, alleen de
 * platte parameters what_and/what_or/what_phrase/what_exclude per aanroep):
 * de AST wordt uitgeschreven naar één of meer "clauses" (elk = precies één
 * Adzuna-aanroep). Een AND van kinderen wordt het cartesisch product van de
 * expansies van die kinderen; een OR van uitsluitend losse termen wordt
 * direct als één what_or in dezelfde aanroep gebruikt (geen opsplitsing
 * nodig — dit is het meest voorkomende geval, bv. "(front-end OR frontend)
 * AND react"). Zodra twee ONAFHANKELIJKE OR-groepen met elkaar ge-AND'd
 * worden (bv. "(a OR b) AND (c OR d)"), kan dat niet in één aanroep: de
 * eerst-gevonden OR-groep blijft als what_or staan, en elk alternatief van
 * de tweede OR-groep wordt uitgeschreven naar een aparte aanroep — de unie
 * van de resulterende aanroepen (na ontdubbeling) is semantisch gelijk aan
 * de volledige, geneste expressie.
 */

export class BooleanQuerySyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BooleanQuerySyntaxError";
  }
}

// ---------------------------------------------------------------------------
// Tokenizer
// ---------------------------------------------------------------------------

type TokenType = "LPAREN" | "RPAREN" | "AND" | "OR" | "NOT" | "PHRASE" | "WORD";

interface Token {
  type: TokenType;
  value?: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ type: "LPAREN" });
      i++;
      continue;
    }
    if (ch === ")") {
      tokens.push({ type: "RPAREN" });
      i++;
      continue;
    }
    if (ch === '"') {
      const end = input.indexOf('"', i + 1);
      if (end === -1) {
        throw new BooleanQuerySyntaxError("Ontbrekend sluitend aanhalingsteken (\") in de zoekterm.");
      }
      const value = input.slice(i + 1, end).trim();
      if (value.length === 0) {
        throw new BooleanQuerySyntaxError("Lege woordgroep tussen aanhalingstekens.");
      }
      tokens.push({ type: "PHRASE", value });
      i = end + 1;
      continue;
    }

    const match = /^[^\s()"]+/.exec(input.slice(i));
    if (!match) {
      throw new BooleanQuerySyntaxError(`Onverwacht teken "${ch}" in de zoekterm.`);
    }
    const raw = match[0];
    i += raw.length;
    const upper = raw.toUpperCase();
    if (upper === "AND") tokens.push({ type: "AND" });
    else if (upper === "OR") tokens.push({ type: "OR" });
    else if (upper === "NOT") tokens.push({ type: "NOT" });
    else tokens.push({ type: "WORD", value: raw });
  }

  return tokens;
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

export interface TermNode {
  type: "term";
  value: string;
  /** True als de term tussen aanhalingstekens stond (exacte woordgroep). */
  exact: boolean;
}

export interface NotNode {
  type: "not";
  term: TermNode;
}

export interface AndNode {
  type: "and";
  children: QueryNode[];
}

export interface OrNode {
  type: "or";
  children: QueryNode[];
}

export type QueryNode = TermNode | NotNode | AndNode | OrNode;

// ---------------------------------------------------------------------------
// Parser (recursive descent)
// ---------------------------------------------------------------------------

class Parser {
  private pos = 0;

  constructor(private readonly tokens: Token[]) {}

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private next(): Token {
    const token = this.tokens[this.pos];
    if (!token) {
      throw new BooleanQuerySyntaxError("Onverwacht einde van de zoekterm.");
    }
    this.pos++;
    return token;
  }

  parse(): QueryNode {
    if (this.tokens.length === 0) {
      throw new BooleanQuerySyntaxError("Zoekterm mag niet leeg zijn.");
    }
    const node = this.parseOr();
    if (this.pos < this.tokens.length) {
      throw new BooleanQuerySyntaxError(
        "Onverwacht symbool in de zoekterm — controleer op een ontbrekende operator (AND/OR) of een teveel aan haakjes.",
      );
    }
    return node;
  }

  private parseOr(): QueryNode {
    const children = [this.parseAnd()];
    while (this.peek()?.type === "OR") {
      this.next();
      children.push(this.parseAnd());
    }
    return children.length === 1 ? children[0] : { type: "or", children };
  }

  private parseAnd(): QueryNode {
    const children = [this.parseNot()];
    // NOT mag direct volgen zonder expliciete AND ervoor ("react NOT stage"
    // == "react AND NOT stage") — gangbare boolean-zoeksyntax.
    while (this.peek()?.type === "AND" || this.peek()?.type === "NOT") {
      if (this.peek()?.type === "AND") this.next();
      children.push(this.parseNot());
    }
    return children.length === 1 ? children[0] : { type: "and", children };
  }

  private parseNot(): QueryNode {
    if (this.peek()?.type === "NOT") {
      this.next();
      const inner = this.parsePrimary();
      if (inner.type !== "term") {
        throw new BooleanQuerySyntaxError(
          'NOT kan alleen direct vóór een los woord of "woordgroep" staan, niet vóór een groep tussen haakjes.',
        );
      }
      return { type: "not", term: inner };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): QueryNode {
    const token = this.peek();
    if (!token) {
      throw new BooleanQuerySyntaxError(
        "Onverwacht einde van de zoekterm — verwachtte een woord, woordgroep of haakje.",
      );
    }

    if (token.type === "LPAREN") {
      this.next();
      const node = this.parseOr();
      const closing = this.peek();
      if (!closing || closing.type !== "RPAREN") {
        throw new BooleanQuerySyntaxError("Ontbrekend sluitend haakje ')' in de zoekterm.");
      }
      this.next();
      return node;
    }

    if (token.type === "WORD") {
      this.next();
      return { type: "term", value: token.value!, exact: false };
    }

    if (token.type === "PHRASE") {
      this.next();
      return { type: "term", value: token.value!, exact: true };
    }

    if (token.type === "RPAREN") {
      throw new BooleanQuerySyntaxError("Onverwacht sluitend haakje ')' zonder bijbehorend openend haakje.");
    }

    throw new BooleanQuerySyntaxError(
      `Onverwachte operator "${token.type}" op deze plek — verwachtte een woord, woordgroep of haakje.`,
    );
  }
}

export function parseBooleanQuery(query: string): QueryNode {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    throw new BooleanQuerySyntaxError("Zoekterm mag niet leeg zijn.");
  }
  const tokens = tokenize(trimmed);
  return new Parser(tokens).parse();
}

// ---------------------------------------------------------------------------
// Vertaling naar Adzuna-parameters
// ---------------------------------------------------------------------------

interface Clause {
  mustTerms: string[];
  phraseTerms: string[];
  excludeTerms: string[];
  orTerms: string[];
}

function emptyClause(): Clause {
  return { mustTerms: [], phraseTerms: [], excludeTerms: [], orTerms: [] };
}

function mergeClauses(a: Clause, b: Clause): Clause {
  return {
    mustTerms: [...a.mustTerms, ...b.mustTerms],
    phraseTerms: [...a.phraseTerms, ...b.phraseTerms],
    excludeTerms: [...a.excludeTerms, ...b.excludeTerms],
    orTerms: [...a.orTerms, ...b.orTerms],
  };
}

/** Combineert twee clauses via AND (cartesisch product op het niveau erboven). */
function combine(a: Clause, b: Clause): Clause[] {
  if (a.orTerms.length > 0 && b.orTerms.length > 0) {
    // Twee onafhankelijke OR-groepen kunnen niet in dezelfde Adzuna-aanroep
    // (die ondersteunt maar één what_or): houd a's OR-groep intact als
    // what_or, en explodeer b's alternatieven naar losse, samen te voegen
    // aanroepen (elke term van b wordt een vereiste AND-term in zijn eigen clause).
    return b.orTerms.map((term) => mergeClauses(a, { ...emptyClause(), mustTerms: [term] }));
  }
  return [mergeClauses(a, b)];
}

/**
 * Een OR-groep mag alleen direct als what_or gebruikt worden als elk
 * alternatief een los, niet-exact woord is. what_or is een Adzuna-parameter
 * voor losse woord-alternatieven — een exacte woordgroep ("front-end
 * developer") erin meenemen zou de woorden los van elkaar splitsen en de
 * zoekopdracht ongewenst verbreden (elk los woord telt dan al als match).
 */
function isPureNonExactTermList(children: QueryNode[]): children is TermNode[] {
  return children.every((c): c is TermNode => c.type === "term" && !c.exact);
}

function expand(node: QueryNode): Clause[] {
  if (node.type === "term") {
    return [node.exact ? { ...emptyClause(), phraseTerms: [node.value] } : { ...emptyClause(), mustTerms: [node.value] }];
  }
  if (node.type === "not") {
    return [{ ...emptyClause(), excludeTerms: [node.term.value] }];
  }
  if (node.type === "or") {
    if (isPureNonExactTermList(node.children)) {
      return [{ ...emptyClause(), orTerms: node.children.map((c) => c.value) }];
    }
    // OR-groep bevat een exacte woordgroep en/of zelf structuur (bv.
    // "(a AND b) OR c" of '"exacte groep" OR los-woord') — elke tak apart
    // uitschrijven en de resultaten verenigen (union = extra aanroepen).
    return node.children.flatMap(expand);
  }
  // node.type === "and"
  return node.children.reduce<Clause[]>((acc, child) => {
    const childClauses = expand(child);
    return acc.flatMap((accClause) => childClauses.flatMap((childClause) => combine(accClause, childClause)));
  }, [emptyClause()]);
}

export interface AdzunaQueryClause {
  what_and?: string;
  what_or?: string;
  what_phrase?: string;
  what_exclude?: string;
}

function toApiClause(clause: Clause): AdzunaQueryClause {
  const mustTerms = [...clause.mustTerms];
  let phrase: string | undefined;

  if (clause.phraseTerms.length > 0) {
    // Adzuna ondersteunt maar één what_phrase per aanroep. De eerste
    // woordgroep wordt echt als exacte frase gebruikt; eventuele volgende
    // woordgroepen in dezelfde clause worden als gewone AND-termen
    // toegevoegd (verliest de exacte-woordgroep-garantie voor die extra
    // frase(s), maar sluit nooit terecht-matchende resultaten uit).
    phrase = clause.phraseTerms[0];
    mustTerms.push(...clause.phraseTerms.slice(1));
  }

  const result: AdzunaQueryClause = {};
  if (mustTerms.length > 0) result.what_and = mustTerms.join(" ");
  if (clause.orTerms.length > 0) result.what_or = clause.orTerms.join(" ");
  if (phrase) result.what_phrase = phrase;
  if (clause.excludeTerms.length > 0) result.what_exclude = clause.excludeTerms.join(" ");
  return result;
}

/**
 * Compileert een booleaanse zoekterm naar één of meer Adzuna-aanroep-
 * parametersets. Meerdere resultaten betekent dat de zoekterm niet in één
 * aanroep uit te drukken was (zie moduledocumentatie bovenin) — de
 * aanroeper voert ze allemaal uit en voegt de resultaten samen met de
 * bestaande ontdubbelingslogica (lib/dedupe.ts).
 */
export function compileBooleanQuery(query: string): AdzunaQueryClause[] {
  const ast = parseBooleanQuery(query);
  return expand(ast).map(toApiClause);
}

// ---------------------------------------------------------------------------
// Leesbare interpretatie (voor live UI-feedback)
// ---------------------------------------------------------------------------

export interface QueryDescription {
  mustContain: string[];
  mayContain: string[];
  excluded: string[];
}

function describeNode(node: QueryNode, insideOr: boolean, out: QueryDescription): void {
  if (node.type === "term") {
    const display = node.exact ? `"${node.value}"` : node.value;
    (insideOr ? out.mayContain : out.mustContain).push(display);
    return;
  }
  if (node.type === "not") {
    out.excluded.push(node.term.exact ? `"${node.term.value}"` : node.term.value);
    return;
  }
  if (node.type === "or") {
    for (const child of node.children) describeNode(child, true, out);
    return;
  }
  for (const child of node.children) describeNode(child, insideOr, out);
}

/**
 * Bouwt een simpele, mensleesbare samenvatting ("moet bevatten" / "mag
 * bevatten" / "uitgesloten") van de zoekterm voor directe UI-feedback. Dit
 * is een benaderende samenvatting, geen exacte herformulering van de
 * booleaanse structuur (nesting/precedentie gaat verloren) — puur bedoeld
 * om in één oogopslag te zien of de tool de zoekterm goed heeft begrepen.
 */
export function describeBooleanQuery(query: string): QueryDescription {
  const ast = parseBooleanQuery(query);
  const out: QueryDescription = { mustContain: [], mayContain: [], excluded: [] };
  describeNode(ast, false, out);
  return out;
}
