import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { addDays, format, startOfDay } from "date-fns";
import { safeFormat, tryParseDate } from "@/utils/dateHelpers";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  MessageSquare,
  Mic2,
  NotebookPen,
  Plus,
  ScanLine,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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

type FollowUp = {
  key: string;
  name: string;
  detail: string | null;
  due: string; // YYYY-MM-DD
  href: string;
};

/** True if today falls within the event's start..end days (inclusive). */
function isHappeningToday(event: CalendarEvent): boolean {
  const start = tryParseDate(event.start_date);
  if (!start) return false;
  const end = tryParseDate(event.end_date) ?? start;
  const today = startOfDay(new Date());
  return startOfDay(start) <= today && today <= startOfDay(end >= start ? end : start);
}

/** Conference and travel blocks on the calendar aren't meetings. */
function isMeeting(event: CalendarEvent): boolean {
  return !/conference|travel/i.test(event.event_type ?? "");
}

function dueLabel(due: string, today: string): string {
  if (due < today) return "Overdue";
  if (due === today) return "Today";
  return safeFormat(due, "EEE, MMM d", due);
}

export default function Today() {
  const navigate = useNavigate();
  const now = new Date();
  const today = format(now, "yyyy-MM-dd");

  const { data, isLoading } = useQuery({
    queryKey: ["today"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const weekEnd = format(addDays(new Date(), 6), "yyyy-MM-dd");
      const [profileResult, eventsResult, conferencesResult, touchpointsResult, contactFollowUps, leadFollowUps] = await Promise.all([
        supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
        // Upcoming events plus multi-day events already in progress (started earlier, end today or later).
        supabase.from("calendar_events").select("id,title,start_date,end_date,start_time,location,event_type").or(`start_date.gte.${today},end_date.gte.${today}`).order("start_date").order("start_time").limit(20),
        supabase.from("conferences").select("id,name,start_date,end_date,location,conference_leads(count)").eq("archived", false).gte("end_date", today).order("start_date").limit(3),
        supabase.from("touchpoints").select("id", { count: "exact", head: true }).gte("date", today),
        supabase.from("contacts").select("id,name,org_name,next_follow_up_date,next_follow_up_note").not("next_follow_up_date", "is", null).lte("next_follow_up_date", weekEnd).order("next_follow_up_date").limit(20),
        supabase.from("conference_leads").select("id,contact_name,company,conference_id,next_follow_up_date,next_follow_up_note").not("next_follow_up_date", "is", null).lte("next_follow_up_date", weekEnd).order("next_follow_up_date").limit(20),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (conferencesResult.error) throw conferencesResult.error;

      // Follow-ups: shown only if both reads worked, so a failure never looks like "none due".
      const followUpsAvailable = !contactFollowUps.error && !leadFollowUps.error;
      const followUps: FollowUp[] = followUpsAvailable
        ? [
            ...(contactFollowUps.data ?? []).map((c) => ({
              key: `c-${c.id}`,
              name: c.name,
              detail: [c.org_name, c.next_follow_up_note].filter(Boolean).join(" · ") || null,
              due: c.next_follow_up_date as string,
              href: "/contacts",
            })),
            ...(leadFollowUps.data ?? []).map((l) => ({
              key: `l-${l.id}`,
              name: l.contact_name,
              detail: [l.company, l.next_follow_up_note].filter(Boolean).join(" · ") || null,
              due: l.next_follow_up_date as string,
              href: `/conferences?selected=${l.conference_id}`,
            })),
          ].sort((a, b) => a.due.localeCompare(b.due))
        : [];

      return {
        name: profileResult.data?.full_name?.trim().split(/\s+/)[0] || null,
        // Text dates: skip rows like "TBD" that sort after every real date.
        events: ((eventsResult.data || []) as CalendarEvent[]).filter((e) => tryParseDate(e.start_date)),
        conferences: conferencesResult.data || [],
        touchesToday: touchpointsResult.error ? null : touchpointsResult.count || 0,
        followUps,
        followUpsAvailable,
      };
    },
  });

  // Rows with a missing or malformed date are skipped rather than crashing the page.
  const weekEndDate = startOfDay(addDays(now, 6));
  const todaysEvents = data?.events.filter((event) => isHappeningToday(event)) || [];
  const nextEvents = todaysEvents.length ? todaysEvents : (data?.events.slice(0, 4) || []);
  const meetingsThisWeek = (data?.events ?? []).filter((e) => {
    const d = tryParseDate(e.start_date);
    return d && isMeeting(e) && startOfDay(d) <= weekEndDate && (startOfDay(d) >= startOfDay(now) || isHappeningToday(e));
  }).length;
  const nextConference = data?.conferences[0];
  const conferenceLeadCount = nextConference?.conference_leads?.[0]?.count || 0;
  const followUps = data?.followUps ?? [];
  const overdue = followUps.filter((f) => f.due < today).length;
  const conferenceStart = nextConference ? tryParseDate(nextConference.start_date) : null;
  const daysToConference = conferenceStart
    ? Math.round((startOfDay(conferenceStart).getTime() - startOfDay(now).getTime()) / 86_400_000)
    : null;

  const formatTime = (time: string | null) => {
    if (!time) return "All day";
    const [hours, minutes = 0] = time.split(":").map(Number);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return time;
    }
    return safeFormat(new Date(2026, 0, 1, hours, minutes), "h:mm a", time);
  };

  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const conferenceWhen = daysToConference === null ? null
    : daysToConference > 1 ? `in ${daysToConference} days`
    : daysToConference === 1 ? "tomorrow"
    : "on now";
  const summary = isLoading
    ? "Loading your day…"
    : [
        followUps.length ? `${followUps.length} follow-up${followUps.length === 1 ? "" : "s"} due this week${overdue ? ` (${overdue} overdue)` : ""}` : null,
        nextConference && conferenceWhen ? `${nextConference.name} ${conferenceWhen}` : null,
      ].filter(Boolean).join(". ") || "Nothing due this week.";

  const stats = [
    {
      label: "Follow-ups due",
      value: data?.followUpsAvailable === false ? null : followUps.length,
      hint: overdue ? `${overdue} overdue` : "next 7 days",
      act: overdue > 0,
      href: "/contacts",
      icon: BellRing,
    },
    { label: "Meetings this week", value: meetingsThisWeek, hint: "next 7 days", act: false, href: "/calendar", icon: CalendarDays },
    { label: "Touches today", value: data?.touchesToday ?? null, hint: "interactions logged", act: false, href: "/contacts", icon: MessageSquare },
    {
      label: "Leads at next conference",
      value: nextConference ? conferenceLeadCount : null,
      hint: nextConference?.name ?? "no conference scheduled",
      act: false,
      href: nextConference ? `/conferences?selected=${nextConference.id}` : "/conferences",
      icon: Users,
    },
  ];

  return (
    <PageLayout className="space-y-6">
      {/* Page header: eyebrow, title, one line, actions on the right */}
      <header className="flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{format(now, "EEEE, MMMM d")}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-primary sm:text-4xl">
            {data?.name ? `${greeting}, ${data.name}.` : `${greeting}.`}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => navigate("/contacts")}>
            <ScanLine className="mr-2 h-4 w-4" /> Scan a card
          </Button>
          <Button onClick={() => navigate("/conferences")}>
            <Mic2 className="mr-2 h-4 w-4" /> Capture a recap
          </Button>
        </div>
      </header>

      {/* At (or about to leave for) a conference: one tap into Floor Mode. */}
      {nextConference && daysToConference !== null && daysToConference <= 2 && (
        <button
          type="button"
          onClick={() => navigate(`/floor?conference=${nextConference.id}`)}
          className="flex w-full items-center gap-4 rounded-2xl bg-primary px-5 py-5 text-left text-primary-foreground shadow-sm transition active:scale-[0.99]"
        >
          <ScanLine className="h-8 w-8 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-semibold">Open Floor Mode</span>
            <span className="block truncate text-sm opacity-80">
              {nextConference.name} {conferenceWhen}: scan cards, record recaps, see who to meet
            </span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </button>
      )}

      {/* Numbers */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => navigate(s.href)}
            className="min-w-0 rounded-lg border border-border bg-card p-5 text-left transition-colors hover:bg-accent"
          >
            <p className="flex items-start gap-1.5 text-xs font-semibold uppercase leading-4 tracking-[0.06em] text-muted-foreground">
              <s.icon className="h-4 w-4 shrink-0" /> <span>{s.label}</span>
            </p>
            <p className={`mt-2 font-mono text-3xl font-semibold tabular-nums tracking-tight ${s.act ? "text-urgent" : "text-foreground"}`}>
              {isLoading || s.value === null ? "—" : s.value}
            </p>
            <p className={`mt-1 truncate text-xs ${s.act ? "font-medium text-urgent" : "text-muted-foreground"}`}>{s.hint}</p>
          </button>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.65fr)]">
        <div className="min-w-0 space-y-6">
          {/* Follow-ups due */}
          <div className="rounded-md border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">Follow-ups due</h2>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/contacts")}>
                Relationships <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
            {data?.followUpsAvailable === false ? (
              <p className="text-sm text-muted-foreground">Follow-up dates couldn't be loaded. Refresh to try again.</p>
            ) : followUps.length ? (
              <ul className="divide-y divide-border">
                {followUps.slice(0, 6).map((f) => {
                  const late = f.due < today;
                  return (
                    <li key={f.key}>
                      <button onClick={() => navigate(f.href)} className="group flex w-full items-center gap-4 py-3 text-left">
                        <span className={`w-24 shrink-0 font-mono text-xs tabular-nums ${late ? "font-semibold text-urgent" : "text-muted-foreground"}`}>
                          {dueLabel(f.due, today)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{f.name}</span>
                          {f.detail && <span className="block truncate text-xs text-muted-foreground">{f.detail}</span>}
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-1" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="rounded-md border border-dashed border-border px-5 py-8 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-semibold text-foreground">No follow-ups due this week</p>
                <p className="mt-1 text-xs text-muted-foreground">Set a next follow-up date on a contact or lead and it shows up here.</p>
              </div>
            )}
          </div>

          {/* Agenda */}
          <div className="rounded-md border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">{todaysEvents.length ? "Today's agenda" : "Coming up"}</h2>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/calendar")}>
                Full calendar <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1">
              {nextEvents.length ? nextEvents.map((event, index) => (
                <button key={event.id} onClick={() => navigate("/calendar")} className="group flex w-full items-center gap-4 rounded-md p-2 text-left transition-colors hover:bg-accent">
                  <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded font-mono ${index === 0 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    <span className="text-[10px] font-semibold uppercase">{safeFormat(event.start_date, "MMM", "—")}</span>
                    <span className="text-lg font-bold leading-none">{safeFormat(event.start_date, "d", "")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold text-foreground">{event.title}</p>
                      {index === 0 && <span className="shrink-0 rounded bg-copper-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-copper">Next</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{formatTime(event.start_time)}</span>
                      {event.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{event.location}</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-1" />
                </button>
              )) : (
                <div className="rounded-md border border-dashed border-border px-5 py-8 text-center">
                  <CalendarDays className="mx-auto h-6 w-6 text-muted-foreground" />
                  <p className="mt-2 text-sm font-semibold text-foreground">Nothing on the calendar</p>
                  <p className="mt-1 text-xs text-muted-foreground">A good moment to close a follow-up loop.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-6">
          {/* Next conference */}
          <div className="rounded-md border border-border bg-card p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Next conference</p>
            {nextConference ? (
              <>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">{nextConference.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[safeFormat(nextConference.start_date, "MMM d", ""), nextConference.location, conferenceWhen].filter(Boolean).join(" · ")}
                </p>
                <p className="mt-3 text-sm text-foreground">
                  <span className="font-mono font-semibold tabular-nums">{conferenceLeadCount}</span>{" "}
                  {conferenceLeadCount === 1 ? "lead" : "leads"} captured so far.
                </p>
                <Button className="mt-5 w-full" onClick={() => navigate(`/conferences?selected=${nextConference.id}`)}>
                  Open conference <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <h2 className="mt-2 font-display text-xl font-semibold tracking-tight text-foreground">None scheduled</h2>
                <p className="mt-1 text-sm text-muted-foreground">Add the next event your team is going to.</p>
                <Button className="mt-5 w-full" onClick={() => navigate("/conferences")}>
                  Add a conference <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          {/* Quick capture */}
          <div className="rounded-md border border-border bg-card p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-foreground">Quick capture</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Log it while it's fresh.</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/contacts")}><Plus className="h-4 w-4 text-muted-foreground" /><span className="text-xs">New contact</span></Button>
              <Button variant="outline" className="h-auto flex-col gap-2 py-4" onClick={() => navigate("/conferences")}><NotebookPen className="h-4 w-4 text-muted-foreground" /><span className="text-xs">Add notes</span></Button>
            </div>
          </div>
        </div>
      </section>
    </PageLayout>
  );
}
