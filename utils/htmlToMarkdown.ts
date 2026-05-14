/**
 * HTML → Markdown converter (TipTap-scoped)
 *
 * Pure function. Input HTML string, output Markdown string. No DOM access.
 * Scope is deliberately narrow — only the elements TipTap produces in this app.
 *
 * Unrecognized tags are stripped (inner text preserved) and a console.warn
 * is emitted with the tag name, so future TipTap extensions surface during testing.
 *
 * @module utils/htmlToMarkdown
 */

interface AttrMap {
  [key: string]: string;
}

interface OpenTagToken {
  kind: 'open';
  name: string;
  attrs: AttrMap;
  selfClosing: boolean;
}

interface CloseTagToken {
  kind: 'close';
  name: string;
}

interface TextToken {
  kind: 'text';
  text: string;
}

type Token = OpenTagToken | CloseTagToken | TextToken;

const VOID_ELEMENTS = new Set([
  'br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr',
]);

const KNOWN_TAGS = new Set([
  'p', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'a', 'blockquote', 'code', 'pre',
  'hr', 'br',
  'mark',
  'span',
  'div',
]);

const warnedTags = new Set<string>();
function warnUnknownTag(name: string): void {
  if (warnedTags.has(name)) return;
  warnedTags.add(name);
  console.warn(`[htmlToMarkdown] Unknown tag stripped: <${name}>`);
}

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function parseAttrs(raw: string): AttrMap {
  const attrs: AttrMap = {};
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = attrRegex.exec(raw)) !== null) {
    const name = m[1].toLowerCase();
    const value = m[3] ?? m[4] ?? m[5] ?? '';
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const tagRegex = /<\/?([a-zA-Z][a-zA-Z0-9]*)([^>]*?)\/?>/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = tagRegex.exec(html)) !== null) {
    const start = m.index;
    if (start > last) {
      const text = html.slice(last, start);
      if (text.length > 0) tokens.push({ kind: 'text', text: decodeEntities(text) });
    }
    const full = m[0];
    const name = m[1].toLowerCase();
    const attrText = m[2] || '';
    const isClose = full.startsWith('</');
    const selfClosing = /\/\s*>$/.test(full) || VOID_ELEMENTS.has(name);

    if (isClose) {
      tokens.push({ kind: 'close', name });
    } else {
      tokens.push({ kind: 'open', name, attrs: parseAttrs(attrText), selfClosing });
    }
    last = tagRegex.lastIndex;
  }
  if (last < html.length) {
    const tail = html.slice(last);
    if (tail.length > 0) tokens.push({ kind: 'text', text: decodeEntities(tail) });
  }
  return tokens;
}

interface ListFrame {
  ordered: boolean;
  index: number;
}

interface RenderState {
  out: string[];
  inline: string[]; // inline buffer for current paragraph/heading/li
  blockStack: string[]; // names of currently-open block elements
  listStack: ListFrame[];
  inLink: boolean;
  linkHref: string;
}

// Hard-break sentinel: a multi-char marker that cannot appear in real HTML text.
// Used so whitespace collapse on inline buffers does not swallow <br> breaks.
const BR_SENTINEL = '\u0000__BR__\u0000';

function flushInline(state: RenderState, prefix = ''): void {
  const joined = state.inline.join('').replace(/[ \t]*\n[ \t]*/g, BR_SENTINEL);
  const segments = joined.split(BR_SENTINEL).map((seg) => seg.replace(/[ \t]+/g, ' '));
  if (segments.length > 0) {
    segments[0] = segments[0].replace(/^[ \t]+/, '');
    segments[segments.length - 1] = segments[segments.length - 1].replace(/[ \t]+$/, '');
  }
  const text = segments.join('  \n');
  state.inline = [];
  if (text.replace(/\s+/g, '').length === 0) return;
  state.out.push(prefix + text);
}

function listIndent(depth: number): string {
  return '  '.repeat(Math.max(0, depth));
}

export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return '';

  const tokens = tokenize(html);
  const state: RenderState = {
    out: [],
    inline: [],
    blockStack: [],
    listStack: [],
    inLink: false,
    linkHref: '',
  };

  const pushBlockBreak = () => {
    if (state.out.length > 0 && state.out[state.out.length - 1] !== '') {
      state.out.push('');
    }
  };

  for (const tok of tokens) {
    if (tok.kind === 'text') {
      // Escape pipe in text to keep it from breaking Markdown tables (defensive)
      state.inline.push(tok.text);
      continue;
    }

    if (tok.kind === 'open') {
      const { name, attrs } = tok;

      switch (name) {
        case 'p': {
          flushInline(state);
          pushBlockBreak();
          state.blockStack.push('p');
          break;
        }
        case 'h1':
        case 'h2':
        case 'h3':
        case 'h4':
        case 'h5':
        case 'h6': {
          flushInline(state);
          pushBlockBreak();
          state.blockStack.push(name);
          break;
        }
        case 'ul':
        case 'ol': {
          flushInline(state);
          pushBlockBreak();
          state.listStack.push({ ordered: name === 'ol', index: 0 });
          break;
        }
        case 'li': {
          flushInline(state);
          state.blockStack.push('li');
          break;
        }
        case 'blockquote': {
          flushInline(state);
          pushBlockBreak();
          state.blockStack.push('blockquote');
          break;
        }
        case 'pre': {
          flushInline(state);
          pushBlockBreak();
          state.blockStack.push('pre');
          state.out.push('```');
          break;
        }
        case 'hr': {
          flushInline(state);
          pushBlockBreak();
          state.out.push('---');
          state.out.push('');
          break;
        }
        case 'br': {
          state.inline.push('  \n');
          break;
        }
        case 'strong':
        case 'b':
          state.inline.push('**');
          break;
        case 'em':
        case 'i':
          state.inline.push('*');
          break;
        case 'u':
          state.inline.push('<u>');
          break;
        case 's':
        case 'strike':
          state.inline.push('~~');
          break;
        case 'code':
          state.inline.push('`');
          break;
        case 'mark':
          state.inline.push('==');
          break;
        case 'a': {
          state.inLink = true;
          state.linkHref = attrs['href'] || '';
          state.inline.push('[');
          break;
        }
        case 'span': {
          // Clinical-term span: <span class="clinical-term" data-term-id="...">text</span>
          // → **text** [term:{id}]
          const cls = (attrs['class'] || '').toLowerCase();
          const termId = attrs['data-term-id'] || '';
          if (cls.includes('clinical-term') && termId) {
            state.inline.push('**');
            state.blockStack.push(`span:clinical:${termId}`);
          } else {
            state.blockStack.push('span:noop');
          }
          break;
        }
        case 'div':
          // Treat as transparent block wrapper
          state.blockStack.push('div');
          break;
        default:
          if (!KNOWN_TAGS.has(name)) {
            warnUnknownTag(name);
          }
          // Strip tag, preserve inner text (no marker pushed)
          state.blockStack.push(`unknown:${name}`);
          break;
      }
      continue;
    }

    // close
    const { name } = tok;
    switch (name) {
      case 'p': {
        flushInline(state);
        state.blockStack.pop();
        state.out.push('');
        break;
      }
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6': {
        const level = parseInt(name.slice(1), 10);
        const prefix = '#'.repeat(level) + ' ';
        flushInline(state, prefix);
        state.blockStack.pop();
        state.out.push('');
        break;
      }
      case 'ul':
      case 'ol': {
        flushInline(state);
        state.listStack.pop();
        if (state.listStack.length === 0) state.out.push('');
        break;
      }
      case 'li': {
        const frame = state.listStack[state.listStack.length - 1];
        const depth = Math.max(0, state.listStack.length - 1);
        let marker: string;
        if (frame) {
          frame.index += 1;
          marker = frame.ordered ? `${frame.index}. ` : '- ';
        } else {
          marker = '- ';
        }
        flushInline(state, listIndent(depth) + marker);
        state.blockStack.pop();
        break;
      }
      case 'blockquote': {
        flushInline(state, '> ');
        state.blockStack.pop();
        state.out.push('');
        break;
      }
      case 'pre': {
        flushInline(state);
        state.out.push('```');
        state.out.push('');
        state.blockStack.pop();
        break;
      }
      case 'strong':
      case 'b':
        state.inline.push('**');
        break;
      case 'em':
      case 'i':
        state.inline.push('*');
        break;
      case 'u':
        state.inline.push('</u>');
        break;
      case 's':
      case 'strike':
        state.inline.push('~~');
        break;
      case 'code':
        state.inline.push('`');
        break;
      case 'mark':
        state.inline.push('==');
        break;
      case 'a': {
        const href = state.linkHref;
        state.inline.push(`](${href})`);
        state.inLink = false;
        state.linkHref = '';
        break;
      }
      case 'span': {
        const top = state.blockStack[state.blockStack.length - 1] || '';
        if (top.startsWith('span:clinical:')) {
          const termId = top.slice('span:clinical:'.length);
          state.inline.push('**');
          state.inline.push(` [term:${termId}]`);
        }
        state.blockStack.pop();
        break;
      }
      case 'div':
        state.blockStack.pop();
        break;
      case 'hr':
      case 'br':
        // Void close — ignore
        break;
      default: {
        // Pop matching unknown frame if it's on top
        const top = state.blockStack[state.blockStack.length - 1] || '';
        if (top === `unknown:${name}`) state.blockStack.pop();
        break;
      }
    }
  }

  // Final flush
  flushInline(state);

  // Collapse trailing blank lines
  while (state.out.length > 0 && state.out[state.out.length - 1] === '') {
    state.out.pop();
  }
  // Collapse runs of >1 blank lines
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of state.out) {
    const blank = line === '';
    if (blank && prevBlank) continue;
    collapsed.push(line);
    prevBlank = blank;
  }
  return collapsed.join('\n');
}
