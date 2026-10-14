"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetricBucket, TrendPoint, AgentWorkload } from "@/types/notifications";

/**
 * Analytics charts backed purely by backend aggregate data.
 * Colors are paired with visible labels everywhere, and each chart
 * container carries an accessible description.
 */

const PALETTE = ["#2563eb", "#f59e0b", "#8b5cf6", "#10b981", "#71717a", "#ef4444"];

const tooltipStyle = {
  borderRadius: 8,
  border: "1px solid #e4e4e7",
  fontSize: 12,
  boxShadow: "0 1px 2px rgb(0 0 0 / 0.05)",
};

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

export function StatusChart({ data }: { data: MetricBucket[] }) {
  if (!data.length) return <EmptyChart label="No status data available yet." />;
  const chartData = data.map((d) => ({ name: d.label ?? d.key, tickets: d.count }));
  return (
    <div role="img" aria-label="Bar chart of tickets by status" className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f4f4f5" }} />
          <Bar dataKey="tickets" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function PriorityChart({ data }: { data: MetricBucket[] }) {
  if (!data.length) return <EmptyChart label="No priority data available yet." />;
  const chartData = data.map((d) => ({ name: d.label ?? d.key, value: d.count }));
  return (
    <div
      role="img"
      aria-label="Pie chart of tickets by priority"
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <EmptyChart label="No trend data available yet." />;
  const chartData = data.map((d) => ({
    date: d.date.length > 10 ? d.date.slice(5) : d.date,
    tickets: d.count,
  }));
  return (
    <div
      role="img"
      aria-label="Line chart of tickets created over time"
      className="h-64 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Line
            type="monotone"
            dataKey="tickets"
            stroke="#2563eb"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkloadChart({ data }: { data: AgentWorkload[] }) {
  if (!data.length) return <EmptyChart label="No agent workload data available yet." />;
  const chartData = data.map((d) => ({
    name: d.agent.name || d.agent.email,
    open: d.open_tickets,
    total: d.total_tickets,
  }));
  return (
    <div
      role="img"
      aria-label="Bar chart of agent ticket workload"
      className="h-72 w-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} interval={0} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f4f4f5" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="open" name="Open" fill="#2563eb" radius={[4, 4, 0, 0]} />
          <Bar dataKey="total" name="All assigned" fill="#a1a1aa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
