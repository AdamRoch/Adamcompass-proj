// Tiny shared style helper. The popover wants a frameless, glassy look that
// matches the "white_minimal" theme in design/01-ui-themes-spec.md; we keep
// the inline CSS here so each window can drop it into a <style> tag without
// pulling in a CSS framework or build-time plugins.

export const RESET_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text",
      "Helvetica Neue", system-ui, sans-serif;
    color: #1a1a1a;
    background: transparent;
    -webkit-font-smoothing: antialiased;
  }
  input, button, select, textarea {
    font: inherit;
    color: inherit;
  }
  button { cursor: pointer; }
`;

export const POPOVER_CSS = `
  ${RESET_CSS}
  body {
    background: rgba(255, 255, 255, 0.86);
    -webkit-backdrop-filter: blur(24px) saturate(180%);
    backdrop-filter: blur(24px) saturate(180%);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
    border: 1px solid rgba(0, 0, 0, 0.08);
  }
  .popover-shell {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100vh;
  }
  .popover-input {
    width: 100%;
    border: 1px solid rgba(0, 0, 0, 0.12);
    background: rgba(255, 255, 255, 0.7);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 15px;
    outline: none;
  }
  .popover-input:focus {
    border-color: #0a84ff;
    box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18);
  }
  .popover-hint {
    font-size: 11px;
    color: rgba(0, 0, 0, 0.55);
    display: flex;
    justify-content: space-between;
  }
  .popover-error {
    color: #c00;
    font-size: 12px;
  }
`;

export const SETTINGS_CSS = `
  ${RESET_CSS}
  body { background: #fafafa; }
  .settings-shell {
    max-width: 640px;
    margin: 0 auto;
    padding: 28px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  h1 { font-size: 20px; margin: 0 0 8px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin: 16px 0 6px; }
  label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #333; }
  input[type="text"], input[type="url"], input[type="password"] {
    border: 1px solid #d0d0d0;
    border-radius: 6px;
    padding: 8px 10px;
    font-size: 14px;
    background: white;
  }
  input:focus { outline: none; border-color: #0a84ff; box-shadow: 0 0 0 3px rgba(10, 132, 255, 0.18); }
  .row { display: flex; gap: 12px; align-items: center; }
  .btn {
    border: 1px solid #c8c8c8;
    background: white;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 13px;
  }
  .btn-primary { background: #0a84ff; color: white; border-color: #0a84ff; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .ok { color: #196d2c; font-size: 12px; }
  .err { color: #c00; font-size: 12px; }
  a { color: #0a84ff; }
  .helper-text { font-size: 12px; color: #777; margin-top: 2px; }
`;
