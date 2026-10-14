import Link from "next/link";
import {
  TicketCheck,
  Users,
  Gauge,
  Bell,
  Tags,
  ScrollText,
  ArrowRight,
  CheckCircle2,
  LifeBuoy,
  MessageSquare,
  Workflow,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Public landing page (server component). Describes the ticket system
 * and its ordinary support workflow — no AI features, no fake product
 * claims.
 */

const features = [
  {
    icon: TicketCheck,
    title: "Ticket lifecycle",
    body: "Every request gets a tracked ticket that moves from open through in progress, pending, resolved, and closed.",
  },
  {
    icon: MessageSquare,
    title: "Structured conversations",
    body: "Public replies keep customers informed while internal notes let the team coordinate privately.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "Customers and agents are notified about replies, assignments, and status changes as they happen.",
  },
  {
    icon: Tags,
    title: "Categories & priorities",
    body: "Route work by category and flag urgency with low, medium, high, and urgent priorities.",
  },
  {
    icon: Gauge,
    title: "Analytics",
    body: "Dashboards show ticket volume, status breakdowns, and agent workload from real backend data.",
  },
  {
    icon: ScrollText,
    title: "Audit trail",
    body: "Administrators can review who changed what and when across the whole system.",
  },
];

const workflow = [
  {
    step: "1",
    title: "Customer submits a ticket",
    body: "Subject, category, priority, and description are captured in a validated form. The customer can track it any time.",
  },
  {
    step: "2",
    title: "Agent picks up the queue",
    body: "Agents see assigned and available tickets, reply to the customer, and update status as work progresses.",
  },
  {
    step: "3",
    title: "Resolved and recorded",
    body: "Once resolved, the conversation stays searchable. Admins oversee users, categories, and the audit log.",
  },
];

const roles = [
  { role: "Customer", body: "Create and track your own support requests, reply to agents, and follow every status change." },
  { role: "Agent", body: "Work the shared queue, respond to customers, keep internal notes, and update ticket status." },
  { role: "Admin", body: "Manage users and categories, assign tickets, review analytics, and inspect audit logs." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <TicketCheck className="h-4.5 w-4.5" aria-hidden="true" />
            </span>
            <span className="text-[15px] font-semibold tracking-tight">DeskFlow</span>
          </div>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Button asChild variant="ghost">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">Create account</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 sm:py-24">
          <Badge className="mb-5 ring-1 ring-inset" variant="outline">
            Support ticket management
          </Badge>
          <h1 className="mx-auto max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            One clear place for every support request
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            DeskFlow is a conventional helpdesk system where customers submit
            tickets, agents resolve them, and administrators keep the whole
            operation running — with a full record of every action.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/register">
                Create a customer account <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Register as a customer or agent instantly — admin accounts need an
            invite code from your administrator.
          </p>
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              How a request moves through the desk
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              An ordinary support workflow — no magic, just a ticket that
              someone owns at every step.
            </p>
          </div>
          <ol className="mt-10 grid gap-5 sm:grid-cols-3">
            {workflow.map((item) => (
              <li
                key={item.step}
                className="relative rounded-xl border bg-card p-6 shadow-sm"
              >
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
                  aria-hidden="true"
                >
                  {item.step}
                </span>
                <h3 className="mt-4 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Roles */}
      <section className="border-b bg-muted/40 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Built for three roles
            </h2>
            <p className="mt-3 text-sm text-muted-foreground sm:text-base">
              Navigation and actions adapt to who signed in. The backend
              enforces every permission.
            </p>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {roles.map((r) => (
              <div key={r.role} className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{r.role}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {r.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Everything a helpdesk needs
            </h2>
          </div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border bg-card p-6 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <f.icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="rounded-2xl border bg-card p-8 text-center shadow-sm sm:p-12">
            <LifeBuoy className="mx-auto h-8 w-8 text-primary" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              Ready to submit a request?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
              Create an account as a customer, agent, or admin — each role gets
              its own screen. Admin registration requires an invite code.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/register">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/login">I have an account</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <p className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            DeskFlow — support ticket management
          </p>
          <p className="flex items-center gap-1.5">
            <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
            Customers · Agents · Administrators
          </p>
        </div>
      </footer>
    </div>
  );
}
