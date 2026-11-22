"use client";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = {
  contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 14, fontSize: 12, boxShadow: "0 10px 30px -12px rgb(60 40 20 / 0.35)" },
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

/** Batang views harian: teal bergaris, hari tertinggi hitam pekat. */
export function DailyBars({ data }: { data: { date: string; views: number }[] }) {
  const max = Math.max(0, ...data.map((d) => d.views));
  return (
    <ResponsiveContainer width="100%" height={210}>
      <BarChart data={data} margin={{ left: -18, right: 4, top: 8 }} barCategoryGap="28%">
        <defs>
          <pattern id="ey-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--teal)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeOpacity={0.45} strokeWidth={2} />
          </pattern>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis dataKey="date" tick={axis} tickLine={false} axisLine={false} tickFormatter={(d: string) => d.slice(8)} />
        <YAxis tick={axis} tickLine={false} axisLine={false} width={44} allowDecimals={false} />
        <Tooltip {...tip} cursor={{ fill: "rgb(255 255 255 / 0.35)" }} />
        <Bar dataKey="views" name="Views" radius={[8, 8, 8, 8]}>
          {data.map((d) => (
            <Cell key={d.date} fill={d.views === max && max > 0 ? "var(--chart-2)" : "url(#ey-hatch)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
