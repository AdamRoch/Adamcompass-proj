import 'server-only';
import MarkdownIt from 'markdown-it';

/**
 * Shared server-side markdown renderer for note bodies, PRDs, etc.
 *
 * `markdown-it` does not parse raw HTML tags by default (we pass `html: false`),
 * and we additionally strip any stray `<script>` / `<style>` markers from the
 * input as a belt-and-braces measure before rendering. The result is safe to
 * dangerouslySetInnerHTML into the page.
 */
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  typographer: true,
});

// Force links to open in a new tab + treat as untrusted.
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));

md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const tok = tokens[idx];
  if (tok) {
    tok.attrSet('target', '_blank');
    tok.attrSet('rel', 'noopener noreferrer');
  }
  return defaultLinkOpen(tokens, idx, options, env, self);
};

function sanitizeInput(raw: string): string {
  // Belt-and-braces: even though html: false rejects raw tags, we still strip
  // the most dangerous markers if some upstream caller re-enables html.
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

export function renderMarkdown(body: string): string {
  return md.render(sanitizeInput(body));
}

export function renderMarkdownInline(body: string): string {
  return md.renderInline(sanitizeInput(body));
}
