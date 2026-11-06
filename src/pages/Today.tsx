import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { format, startOfDay } from "date-fns";
import { safeFormat, tryParseDate } from "@/utils/dateHelpers";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Mic2,
  NotebookPen,
  Plus,
  ScanLine,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageLayout } from "@/components/PageLayout";

type CalendarEvent = {
  id: string;
  title: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  location: string | null;
  event_type: string;
};

/** True if today falls within the event's start..end days (inclusive). */
function isHappeningToday(event: CalendarEvent): boolean {
  const start = tryParseDate(event.start_date);
  if (!start) return false;
  const end = tryParseDate(event.end_date) ?? start;
  const today = startOfDay(new Date());
  return startOfDay(start) <= today && today <= startOfDay(end >= start ? end : start);
}

export default function Today() {
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["today-command-center"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const today = format(new Date(), "yyyy-MM-dd");
      const [profileResult, eventsResult, conferencesResult, contactsResult, touchpointsResult] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        // Upcoming events plus multi-day events already in progress (started earlier, end today or later).
        supabase.from("calendar_events").select("id,title,start_date,end_date,start_time,location,event_type").or(`start_date.gte.${today},end_date.gte.${today}`).order("start_date").order("start_time").limit(8),
        supabase.from("conferences").select("id,name,start_date,end_date,location,conference_leads(count)").eq("archived", false).gte("end_date", today).order("start_date").limit(3),
        supabase.from("contacts").select("id", { count: "exact", head: true }),
        supabase.from("touchpoints").select("id", { count: "exact", head: true }).gte("date", format(startOfDay(new Date()), "yyyy-MM-dd")),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (conferencesResult.error) throw conferencesResult.error;

      return {
        name: profileResult.data?.full_name?.split(" ")[0] || user.email?.split("@")[0] || "there",
        events: (eventsResult.data || []) as CalendarEvent[],
        conferences: conferencesResult.data || [],
        contactCount: contactsResult.count || 0,
        touchesToday: touchpointsResult.count || 0,
      };
    },
  });

  // Rows with a missing or malformed date are skipped rather than crashing the page.
  const todaysEvents = data?.events.filter((event) => isHappeningToday(event)) || [];
  const nextEvents = todaysEvents.length ? todaysEvents : (data?.events.slice(0, 3) || []);
  const nextConference = data?.conferences[0];
  const conferenceLeadCount = nextConference?.conference_leads?.[0]?.count || 0;

  const formatTime = (time: string | null) => {
    if (!time) return "All day";
    const [hours, minutes = 0] = time.split(":").map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return time;
    }
    return safeFormat(new Date(2026, 0, 1, hours, minutes), "h:mm a", time);
  };

  return (
    <PageLayout className="space-y-8">
      <section className="relative overflow-hidden rounded-lg bg-inverse px-6 py-7 text-inverse-foreground sm:px-8 sm:py-9">
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,.10)_1px,transparent_1px)] [background-size:16px_16px]" />
        <div className="relative flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
          <div>
            <div className="mb-5 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-sidebar-primary">
              <Zap className="h-4 w-4" /> Daily command center
            </div>
            <p className="text-sm font-medium text-inverse-muted">{format(new Date(), "EEEE, MMMM d")}</p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
              Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {data?.name || "there"}.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-inverse-foreground/85 sm:text-base">
              {isLoading
                ? "Building your briefing…"
                : nextEvents.length
                  ? `You have ${nextEvents.length} ${nextEvents.length === 1 ? "priority item" : "priority items"} in view. Capture the context while it is fresh.`
                  : "Your schedule is clear. Use the space to prepare relationships and follow-ups."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-inverse-foreground/25 bg-transparent text-inverse-foreground hover:bg-inverse-foreground/10 hover:text-inverse-foreground" onClick={() => navigate("/contacts") }>
              <ScanLine className="mr-2 h-4 w-4" /> Scan a card
            </Button>
            <Button className="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90" onClick={() => navigate("/conferences") }>
              <Mic2 className="mr-2 h-4 w-4" /> Capture a recap
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Relationships", value: data?.contactCount || 0, detail: "people in shared intelligence", icon: Users, color: "text-signal", bg: "bg-signal-muted" },
          { label: "Touches today", value: data?.touchesToday || 0, detail: "interactions captured", icon: TrendingUp, color: "text-success", bg: "bg-success/10" },
          { label: "Upcoming events", value: data?.events.length || 0, detail: "meetings and conferences", icon: CalendarDays, color: "text-info-blue", bg: "bg-info-blue-bg" },
        ].map(({ label, value, detail, icon: Icon, color, bg }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
                <p className="mt-2 font-mono text-3xl font-semibold tracking-tight text-foreground">{isLoading ? "—" : value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
              </div>
              <div className={`rounded-lg p-2.5 ${bg} ${color}`}><Icon className="h-5 w-5" /></div>
            </div>
          </div>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">Your rhythm</p>
              <h2 className="mt-1 font-display text-xl font-semibold tracking-tight text-foreground">{todaysEvents.length ? "Today’s agenda" : "Coming up"}</h2>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/calendar")}>Full calendar <ArrowRight className="ml-1.5 h-4 w-4" /></Button>
          </div>

          <div className="space-y-2">
            {nextEvents.length ? nextEvents.map((event, index) => (
              <button key={event.id} onClick={() => navigate("/calendar")} className="group flex w-full items-center gap-4 rounded-lg border border-transparent p-3 text-left transition-colors hover:border-border hover:bg-accent">
                <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg font-mono ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <span className="text-[10px] font-semibold uppercase">{safeFormat(event.start_date, "MMM")}</span>
                  <span className="text-lg font-bold leading-none">{safeFormat(event.start_date, "d", "")}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                    {index === 0 && <Badge className="rounded-xl bg-signal-muted text-signal hover:bg-signal-muted">Next</Badge>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatTime(event.start_time)}</span>
                    {event.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover:translate-x-1 group-hover:text-signal" />
              </button>
            )) : (
              <div className="rounded-lg border border-dashed border-border px-5 py-10 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
                <p className="mt-3 text-sm font-semibold text-foreground">Nothing urgent on the calendar</p>
                <p className="mt-1 text-xs text-muted-foreground">A good moment to close a follow-up loop.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-signal/20 bg-signal-muted p-5 sm:p-6">
            <div className="flex items-center gap-2 text-signal"><Sparkles className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em]">Wolf signal</span></div>
            <h2 className="mt-4 font-display text-xl font-semibold tracking-tight text-foreground">{nextConference ? "Prepare the room before you enter it." : "Your relationship graph gets smarter with every note."}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {nextConference
                ? `${nextConference.name} is your next conference. You have ${conferenceLeadCount} ${conferenceLeadCount === 1 ? "lead" : "leads"} connected so far.`
                : "Capture names, context, and commitments so the next opportunity begins with an informed conversation."}
            </p>
            <Button className="mt-5 w-full" onClick={() => navigate("/conferences") }>
              {nextConference ? "Open conference plan" : "Plan a conference"} <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="rounded-lg border border-border bg-card p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-foreground">Quick capture</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Put the signal somewhere useful before it disappears.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/contacts") }><Plus className="h-4 w-4 text-signal" /><span className="text-xs">New contact</span></Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/conferences") }><NotebookPen className="h-4 w-4 text-signal" /><span className="text-xs">Add notes</span></Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
