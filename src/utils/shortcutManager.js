import yaml from 'js-yaml';
import defaultShortcutsRaw from './shortcuts.yaml?raw';

const STORAGE_KEY = 'gme_custom_shortcuts';

// Default shortcuts from YAML
const defaultShortcuts = yaml.load(defaultShortcutsRaw);

/**
 * Loads current shortcuts: default + user overrides from localStorage
 */
export const loadShortcuts = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const custom = JSON.parse(saved);
      return { ...defaultShortcuts, ...custom };
    } catch (e) {
      console.error('Failed to parse custom shortcuts', e);
    }
  }
  return { ...defaultShortcuts };
};

/**
 * Saves a shortcut override to localStorage
 */
export const saveShortcut = (action, keyCombo) => {
  const currentCustom = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  currentCustom[action] = keyCombo;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(currentCustom));
};

/**
 * Resets shortcuts to defaults
 */
export const resetShortcuts = () => {
  localStorage.removeItem(STORAGE_KEY);
};

/**
 * Returns a platform-formatted shortcut string (e.g. "⌘+S" or "Ctrl+S")
 */
export const formatShortcut = (combo) => {
  if (!combo) return '';
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const mod = isMac ? '⌘' : 'Ctrl';
  
  return combo
    .split('+')
    .map(part => {
      if (part.toLowerCase() === 'mod') return mod;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join('+');
};

/**
 * Checks if a KeyboardEvent matches a shortcut combo
 */
export const matchesShortcut = (e, combo) => {
  if (!combo) return false;
  
  const isMac = typeof window !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
  const isMod = isMac ? e.metaKey : e.ctrlKey;
  const parts = combo.toLowerCase().split('+');
  const key = parts[parts.length - 1];
  
  const hasMod = parts.includes('mod');
  const hasShift = parts.includes('shift');
  const hasAlt = parts.includes('alt');
  
  // Normalize backtick for comparison
  const eventKey = e.key.toLowerCase();
  const targetKey = key === '`' ? '`' : key;

  return (
    isMod === hasMod &&
    e.shiftKey === hasShift &&
    e.altKey === hasAlt &&
    eventKey === targetKey
  );
};
