"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "var(--foreground)" },
};

export function ViewsChart({ data }: { data: { date: string; views: number; ctr: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="v" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="var(--chart-1)" stopOpacity={0.35} />
            <stop offset="1" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tick={axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis tick={axis} width={48} />
        <Tooltip {...tip} />
        <Area type="monotone" dataKey="views" name="Views" stroke="var(--chart-1)" strokeWidth={2} fill="url(#v)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CtrChart({ data }: { data: { date: string; ctr: number | null }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tick={axis} tickFormatter={(d: string) => d.slice(5)} minTickGap={24} />
        <YAxis tick={axis} width={48} unit="%" />
        <Tooltip {...tip} />
        <Line type="monotone" dataKey="ctr" name="CTR %" stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RetentionChart({ data }: { data: { x: number; y: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="x" tick={axis} unit="%" />
        <YAxis tick={axis} width={48} unit="%" />
        <Tooltip {...tip} />
        <Area type="monotone" dataKey="y" name="Penonton tersisa" stroke="var(--chart-3)" fill="var(--chart-3)" fillOpacity={0.15} strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function TrafficChart({ data }: { data: { source: string; views: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 28)}>
      <BarChart data={data} layout="vertical" margin={{ left: 24, right: 16 }}>
        <XAxis type="number" tick={axis} />
        <YAxis type="category" dataKey="source" tick={axis} width={120} />
        <Tooltip {...tip} />
        <Bar dataKey="views" name="Views" fill="var(--chart-1)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
