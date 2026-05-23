import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popover } from './Popover.js';
import { POPOVER_CSS } from '../lib/styles.js';

const styleTag = document.createElement('style');
styleTag.textContent = POPOVER_CSS;
document.head.appendChild(styleTag);

const root = document.getElementById('root');
if (!root) throw new Error('missing #root');
createRoot(root).render(<Popover />);
