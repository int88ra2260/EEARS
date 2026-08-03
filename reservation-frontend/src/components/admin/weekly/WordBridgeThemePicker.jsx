import React from 'react';
import { Form } from 'react-bootstrap';
import { WORD_BRIDGE_THEME_BANKS } from '../../../data/wordBridgeThemes';

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export default function WordBridgeThemePicker({
  level,
  themeIds = [],
  onLevelChange,
  onThemeIdsChange,
}) {
  const bank = WORD_BRIDGE_THEME_BANKS[level] || [];
  const selected = new Set(themeIds);

  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else if (next.size < 4) {
      next.add(id);
    }
    onThemeIdsChange(Array.from(next));
  };

  return (
    <div className="weekly-theme-picker">
      <Form.Group className="mb-2">
        <Form.Label>語彙難度</Form.Label>
        <Form.Select value={level} onChange={(e) => onLevelChange(e.target.value)}>
          {LEVELS.map((lv) => (
            <option key={lv} value={lv}>{lv}</option>
          ))}
        </Form.Select>
      </Form.Group>
      <p className="small text-muted mb-2">已選 {themeIds.length} / 4 個主題</p>
      <div className="weekly-theme-picker__grid">
        {bank.map((theme) => {
          const isOn = selected.has(theme.id);
          const disabled = !isOn && selected.size >= 4;
          return (
            <button
              key={theme.id}
              type="button"
              className={`weekly-theme-picker__chip${isOn ? ' is-selected' : ''}`}
              disabled={disabled}
              onClick={() => toggle(theme.id)}
            >
              <span className="weekly-theme-picker__name">{theme.theme}</span>
              <span className="weekly-theme-picker__id">{theme.id}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
