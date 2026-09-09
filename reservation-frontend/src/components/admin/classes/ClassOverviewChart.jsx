import React from 'react';
import { Col, Row } from 'react-bootstrap';
import {
  Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  CHART_SERIES,
  CHART_ANIM,
  CHART_AXIS_TICK,
  CHART_AXIS_LABEL,
  CHART_CURSOR_FILL,
  CHART_MARGIN,
  ChartCard,
  ChartGrid,
  ChartTooltip,
} from '../../charts';

export default function ClassOverviewChart({ data }) {
  if (!data.length) return null;
  const chartData = data.map((item) => ({
    name: item.className,
    fullName: item.className,
    coverage: item.coverage,
    attends: item.attendedCountTotal,
  }));

  return (
    <Row className="mb-4">
      <Col xs={12}>
        <ChartCard
          title="各班參與率"
          description="班級覆蓋率（%）"
          plotHeight={300}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ ...CHART_MARGIN.bar, bottom: 72 }}>
              <ChartGrid vertical={false} />
              <XAxis
                dataKey="name"
                angle={-45}
                textAnchor="end"
                height={90}
                interval={0}
                tick={CHART_AXIS_LABEL}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={CHART_AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip
                cursor={CHART_CURSOR_FILL}
                content={(tipProps) => (
                  <ChartTooltip
                    {...tipProps}
                    preferFullName
                    formatName={() => '參與率'}
                    formatValue={(v) => `${Number(v).toFixed(1)}%`}
                  />
                )}
              />
              <Bar
                dataKey="coverage"
                name="參與率(%)"
                fill={CHART_SERIES.primary}
                radius={[10, 10, 0, 0]}
                maxBarSize={48}
                isAnimationActive
                animationDuration={CHART_ANIM.duration}
                animationEasing={CHART_ANIM.easing}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </Col>
    </Row>
  );
}
