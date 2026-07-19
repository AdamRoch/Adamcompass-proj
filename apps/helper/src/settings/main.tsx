import { createRoot } from 'react-dom/client';
import { SETTINGS_CSS } from '../lib/styles.js';
import { Settings } from './Settings.js';

const styleTag = document.createElement('style');
styleTag.textContent = SETTINGS_CSS;
document.head.appendChild(styleTag);

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(<Settings />);
