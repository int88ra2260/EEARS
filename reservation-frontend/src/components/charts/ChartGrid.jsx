import React from 'react';
import { CartesianGrid } from 'recharts';
import { CHART_GRID_PROPS } from './chartTheme';

/** Soft horizontal/vertical grid matching EEARS chart kit. */
export default function ChartGrid({
  horizontal = true,
  vertical = false,
  ...rest
}) {
  return (
    <CartesianGrid
      {...CHART_GRID_PROPS}
      horizontal={horizontal}
      vertical={vertical}
      {...rest}
    />
  );
}
