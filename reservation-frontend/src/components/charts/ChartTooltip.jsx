import React from 'react';
import { CHART_PALETTE, chartColor } from './chartTheme';
import './chartKit.css';

/**
 * Soft tooltip for Recharts. Supports single or multi-series payloads.
 *
 * @param {object} props
 * @param {boolean} [props.active]
 * @param {Array} [props.payload]
 * @param {string} [props.label]
 * @param {boolean} [props.preferFullName] — use payload.fullName when present (pie/bar category charts)
 * @param {(value: unknown, name: string, item: object) => React.ReactNode} [props.formatValue]
 * @param {(name: string, item: object) => string} [props.formatName]
 */
export default function ChartTooltip({
  active,
  payload,
  label,
  preferFullName = false,
  formatValue,
  formatName,
}) {
  if (!active || !payload?.length) return null;

  const titleFromRow = preferFullName
    ? (payload[0]?.payload?.fullName || payload[0]?.payload?.name || label)
    : label;

  return (
    <div className="eears-chart-tooltip">
      <div
        className="eears-chart-tooltip__swatch"
        style={{
          backgroundColor:
            payload[0]?.payload?.fill ||
            payload[0]?.color ||
            chartColor(0),
        }}
      />
      <div>
        {titleFromRow ? (
          <div className="eears-chart-tooltip__label">{titleFromRow}</div>
        ) : null}
        {payload.map((item, index) => {
          const name = formatName
            ? formatName(item.name, item)
            : (item.name ?? '');
          const raw = item.value ?? item.payload?.count ?? 0;
          const valueNode = formatValue
            ? formatValue(raw, item.name, item)
            : String(raw);
          return (
            <div className="eears-chart-tooltip__row" key={`${name}-${index}`}>
              <div className="eears-chart-tooltip__value">
                {name ? (
                  <span className="eears-chart-tooltip__label d-block mb-0" style={{ fontSize: '0.75rem' }}>
                    {name}
                  </span>
                ) : null}
                {valueNode}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { CHART_PALETTE };
