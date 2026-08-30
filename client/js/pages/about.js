/**
 * About page: static content only, so it just needs the shared chrome and one
 * icon-render pass for the inline glyphs.
 */

import { initChrome } from '../nav.js';
import { renderIcons } from '../ui.js';

initChrome();
renderIcons();
