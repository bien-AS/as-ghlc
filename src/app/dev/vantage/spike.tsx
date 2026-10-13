"use client";

import {
  Button,
  type Column,
  DataTable,
  EmptyState,
  KpiTile,
  type NavGroup,
  Sidebar,
  StatusPill,
  TopBar,
} from "@vantage/design-system";
import { FileText, Layers, Search, Settings, Target } from "lucide-react";
import { useState } from "react";

// Development only: the Vantage kit's own shell and data components, on this app's
// React 19 and Tailwind 4. See page.tsx.

const GROUPS: NavGroup[] = [
  {
    id: "work",
    label: "Work",
    items: [
      { id: "leads", label: "Leads", icon: Target, badge: 12 },
      { id: "review", label: "Review queue", icon: Search, badge: 3 },
      { id: "decks", label: "Decks", icon: Layers },
      { id: "proposals", label: "Proposals", icon: FileText },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [{ id: "settings", label: "Settings", icon: Settings }],
  },
];

interface Row {
  id: string;
  company: string;
  stage: string;
  verdict: "pass" | "attention" | "fail";
  ageDays: number | null;
}

const ROWS: Row[] = [
  {
    id: "1",
    company: "Northwind Roofing",
    stage: "Discovery booked",
    verdict: "pass",
    ageDays: 2,
  },
  {
    id: "2",
    company: "Harbor Dental",
    stage: "Incoming",
    verdict: "attention",
    ageDays: 0,
  },
  {
    id: "3",
    company: "SEO Deals 4U",
    stage: "Incoming",
    verdict: "fail",
    ageDays: null,
  },
];

const COLUMNS: Column<Row>[] = [
  {
    id: "company",
    header: "Company",
    cell: (r) => r.company,
    value: (r) => r.company,
    locked: true,
  },
  {
    id: "stage",
    header: "Stage",
    cell: (r) => r.stage,
    value: (r) => r.stage,
  },
  {
    id: "verdict",
    header: "Verdict",
    cell: (r) => <StatusPill state={r.verdict} />,
    value: (r) => r.verdict,
  },
  {
    id: "age",
    header: "Age (days)",
    cell: (r) => r.ageDays ?? "Not measured",
    value: (r) => r.ageDays,
    numeric: true,
  },
];

export function VantageSpike() {
  const [active, setActive] = useState("leads");
  return (
    <div className="flex min-h-screen">
      <Sidebar
        groups={GROUPS}
        activeId={active}
        onNavigate={setActive}
        brand={<span className="font-semibold text-ink-on-dark">AS Sales</span>}
        user={{ name: "Bien Jamon", initials: "BJ", sublabel: "Admin" }}
      />
      <main className="min-w-0 flex-1">
        <TopBar
          title="Leads"
          subtitle="Kit components on React 19 and Tailwind 4"
          breadcrumbs={[{ label: "Dev" }, { label: "Vantage spike" }]}
          actions={
            <>
              <Button variant="secondary">Export</Button>
              <Button variant="primary">New lead</Button>
            </>
          }
        />
        <div className="grid gap-4 p-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <KpiTile label="New this week" value={12} unit="leads" />
            <KpiTile label="Suspects to review" value={3} />
            <KpiTile label="Proposal value" value={null} />
          </div>
          <DataTable
            rows={ROWS}
            columns={COLUMNS}
            rowId={(r) => r.id}
            caption="Sample leads"
            searchPlaceholder="Search leads"
          />
          <EmptyState
            variant="empty"
            title="No decks yet"
            body="Decks appear here once a lead is validated."
          />
          <div className="flex gap-2">
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Mark as spam</Button>
          </div>
        </div>
      </main>
    </div>
  );
}
