import { marked, type Token, type Tokens } from "marked";

import type { JSONContent } from "./types";

/**
 * Two-way bridge between the fuma-comment editor's content (a tiptap/ProseMirror JSON doc) and the
 * Markdown that GitHub Discussions store.
 *   - `contentToMarkdown` serializes what the user typed into GitHub-flavored Markdown (write).
 *   - `markdownToContent` parses a comment's Markdown back into the JSON doc the UI renders (read).
 *
 * The editor's schema is small and fixed: paragraphs, code blocks, images, mentions, and the marks
 * bold / italic / strike / inline-code / link. That subset maps faithfully both ways; richer Markdown
 * authored directly on GitHub (headings, lists, quotes) degrades to paragraphs so nothing vanishes in
 * the renderer (which silently drops node types it doesn't recognize).
 */

// ── doc -> Markdown ───────────────────────────────────────────────────────────────────────────────

function escapeText(text: string): string {
  return text.replace(/([\\`*_~])/g, "\\$1");
}

function inlineToMarkdown(node: JSONContent): string {
  if (node.type === "text") {
    const marks = node.marks ?? [];
    const has = (t: string) => marks.some((m) => m.type === t);
    if (has("code")) return "`" + (node.text ?? "").replace(/`/g, "") + "`";

    let text = escapeText(node.text ?? "");
    if (has("bold")) text = `**${text}**`;
    if (has("italic")) text = `_${text}_`;
    if (has("strike")) text = `~~${text}~~`;
    const link = marks.find((m) => m.type === "link");
    const href = link?.attrs?.href;
    if (typeof href === "string" && href) text = `[${text}](${href})`;
    return text;
  }
  if (node.type === "mention") {
    // The mention's `id` is the GitHub login — that's what GitHub links, NOT the display-name label.
    const a = node.attrs ?? {};
    return `@${(a.id as string) ?? (a.label as string) ?? ""}`;
  }
  if (node.type === "image") {
    const a = node.attrs ?? {};
    return `![${(a.alt as string) ?? ""}](${(a.src as string) ?? ""})`;
  }
  if (node.type === "hardBreak") return "\n";
  return (node.content ?? []).map(inlineToMarkdown).join("");
}

function blockToMarkdown(node: JSONContent): string {
  switch (node.type) {
    case "paragraph":
      return (node.content ?? []).map(inlineToMarkdown).join("");
    case "codeBlock": {
      const lang = (node.attrs?.language as string) ?? "";
      const code = (node.content ?? []).map((c) => c.text ?? "").join("");
      return "```" + lang + "\n" + code + "\n```";
    }
    case "image":
      return inlineToMarkdown(node);
    default:
      return (node.content ?? []).map(blockToMarkdown).join("\n\n");
  }
}

export function contentToMarkdown(doc: JSONContent | null | undefined): string {
  if (!doc || doc.type !== "doc") return "";
  return (doc.content ?? [])
    .map(blockToMarkdown)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// ── Markdown -> doc ───────────────────────────────────────────────────────────────────────────────

function text(value: string, marks?: JSONContent["marks"]): JSONContent {
  return marks && marks.length ? { type: "text", text: value, marks } : { type: "text", text: value };
}

function withMark(
  nodes: JSONContent[],
  mark: { type: string; attrs?: Record<string, unknown> },
): JSONContent[] {
  return nodes.map((n) => (n.type === "text" ? { ...n, marks: [...(n.marks ?? []), mark] } : n));
}

// A GitHub @mention: preceded by start/whitespace/"(" (so emails like a@b don't match), a valid-ish
// login (alphanumeric with single interior hyphens, no leading/trailing hyphen).
const MENTION_RE = /(?<=^|[\s(])@([a-zA-Z\d](?:-?[a-zA-Z\d]){0,38})/g;

/** Split a plain string into text + mention nodes, so `@login` renders as a styled mention chip. */
function splitMentions(value: string): JSONContent[] {
  const out: JSONContent[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((m = MENTION_RE.exec(value)) !== null) {
    if (m.index > last) out.push(text(value.slice(last, m.index)));
    out.push({ type: "mention", attrs: { id: m[1], label: m[1] } });
    last = m.index + m[0].length;
  }
  if (last < value.length) out.push(text(value.slice(last)));
  return out.length ? out : [text(value)];
}

function inlineFromTokens(tokens: Token[] | undefined): JSONContent[] {
  const out: JSONContent[] = [];
  for (const tok of tokens ?? []) {
    switch (tok.type) {
      case "text": {
        const t = tok as Tokens.Text;
        if (t.tokens && t.tokens.length) out.push(...inlineFromTokens(t.tokens));
        else out.push(...splitMentions(t.text));
        break;
      }
      case "escape":
        out.push(text((tok as Tokens.Escape).text));
        break;
      case "strong":
        out.push(...withMark(inlineFromTokens((tok as Tokens.Strong).tokens), { type: "bold" }));
        break;
      case "em":
        out.push(...withMark(inlineFromTokens((tok as Tokens.Em).tokens), { type: "italic" }));
        break;
      case "del":
        out.push(...withMark(inlineFromTokens((tok as Tokens.Del).tokens), { type: "strike" }));
        break;
      case "codespan":
        out.push(text((tok as Tokens.Codespan).text, [{ type: "code" }]));
        break;
      case "link": {
        const l = tok as Tokens.Link;
        out.push(...withMark(inlineFromTokens(l.tokens), { type: "link", attrs: { href: l.href } }));
        break;
      }
      case "image": {
        const im = tok as Tokens.Image;
        out.push({ type: "image", attrs: { src: im.href, alt: im.text ?? "" } });
        break;
      }
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "html":
        out.push(text((tok as Tokens.HTML).text.replace(/<[^>]*>/g, "")));
        break;
      default: {
        const raw = (tok as { raw?: string }).raw;
        if (raw) out.push(text(raw));
      }
    }
  }
  return out;
}

function paragraph(content: JSONContent[]): JSONContent {
  return { type: "paragraph", content };
}

function blocksFromTokens(tokens: Token[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const tok of tokens) {
    switch (tok.type) {
      case "paragraph":
        out.push(paragraph(inlineFromTokens((tok as Tokens.Paragraph).tokens)));
        break;
      case "text": {
        const t = tok as Tokens.Text;
        out.push(paragraph(t.tokens ? inlineFromTokens(t.tokens) : splitMentions(t.text)));
        break;
      }
      case "code": {
        const c = tok as Tokens.Code;
        out.push({
          type: "codeBlock",
          attrs: { language: c.lang || null },
          content: c.text ? [text(c.text)] : [],
        });
        break;
      }
      case "heading":
        out.push(
          paragraph(withMark(inlineFromTokens((tok as Tokens.Heading).tokens), { type: "bold" })),
        );
        break;
      case "blockquote":
        for (const inner of blocksFromTokens((tok as Tokens.Blockquote).tokens)) out.push(inner);
        break;
      case "list": {
        const list = tok as Tokens.List;
        let n = typeof list.start === "number" && list.start ? list.start : 1;
        for (const item of list.items) {
          const marker = list.ordered ? `${n++}. ` : "• ";
          out.push(paragraph([text(marker), ...inlineFromTokens(item.tokens)]));
        }
        break;
      }
      case "hr":
      case "space":
        break;
      case "html":
        out.push(paragraph([text((tok as Tokens.HTML).text.replace(/<[^>]*>/g, "").trim())]));
        break;
      default: {
        const raw = (tok as { raw?: string }).raw?.trim();
        if (raw) out.push(paragraph([text(raw)]));
      }
    }
  }
  return out.filter((b) => b.type !== "paragraph" || (b.content?.length ?? 0) > 0);
}

export function markdownToContent(md: string | null | undefined): JSONContent {
  const tokens = marked.lexer(md ?? "");
  const content = blocksFromTokens(tokens);
  return { type: "doc", content: content.length ? content : [paragraph([])] };
}
