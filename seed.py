#!/usr/bin/env python3
"""
Seed Forage Bali tasks from the v2 Week-by-Week Operating Plan.
Clears existing tasks and inserts all new ones.
"""
import json
import urllib.request
import urllib.error
from datetime import datetime

SUPABASE_URL = "https://uojnuqpfurwgngjqkbjg.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVvam51cXBmdXJ3Z25nanFrYmpnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzgxMzcsImV4cCI6MjA4NjcxNDEzN30.H2ZxY110AVSbwxEc1op3IUjP-h8G0IldptPmAqpyBVk"

HEADERS = {
    "apikey": ANON_KEY,
    "Authorization": f"Bearer {ANON_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}

def req(method, path, body=None):
    url = f"{SUPABASE_URL}/rest/v1{path}"
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(r) as resp:
            text = resp.read().decode()
            return json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
        return None

def t(title, owner, week, month, priority="normal", status="todo", description=None):
    return {
        "title": title,
        "description": description,
        "owner": owner,
        "week": week,
        "month": month,
        "priority": priority,
        "status": status,
        "project": "forage-bali",
    }

# ─────────────────────────────────────────────
# ALL TASKS — v2 Week-by-Week Plan
# ─────────────────────────────────────────────
TASKS = [

    # ══════════════════════════════════════════
    # MONTH 1 — FOUNDATION (Feb 24 – Mar 22)
    # ══════════════════════════════════════════

    # ── WEEK 1 (Feb 24 – Mar 1) ──
    t("Decide cancellation policy (days notice + refund %)", "Iso", "Week 1", "Month 1", "high"),
    t("Decide transport: included or $20 add-on?", "Iso", "Week 1", "Month 1", "high"),
    t("Create Supabase tables: guests, bookings, plants, sessions, partners, reviews, inquiries", "Iso", "Week 1", "Month 1", "high"),
    t("Get Bokun API keys from dashboard", "Iso", "Week 1", "Month 1", "high"),
    t("Design flyer (use ForageSF pamphlet as template)", "Iso", "Week 1", "Month 1", "normal", description="Yuka gets sample printed, Iso approves before bulk print"),
    t("Review + approve brand voice doc (Alex drafts this week)", "Iso", "Week 1", "Month 1", "normal"),
    t("Mobile responsive check on foragebali.com", "Iso", "Week 1", "Month 1", "normal"),

    t("Finalize partnership agreement with Iso", "Yuka", "Week 1", "Month 1", "high"),
    t("Confirm guest meeting point (Ubud pickup location)", "Yuka", "Week 1", "Month 1", "high"),
    t("Get transport/bus pricing (14-15 person capacity)", "Yuka", "Week 1", "Month 1", "high"),
    t("Reach out to Made: confirm availability for 3 free April classes", "Yuka", "Week 1", "Month 1", "high", description="Pay Made 2M IDR / ~$80 per class"),
    t("Instagram: first 4 posts go up", "Yuka", "Week 1", "Month 1", "normal"),
    t("Follow 10 Bali tourism accounts/day", "Yuka", "Week 1", "Month 1", "normal"),

    t("Book as customer — full e2e Bokun test", "Carla", "Week 1", "Month 1", "high"),
    t("Bokun → Google Calendar sync", "Carla", "Week 1", "Month 1", "high"),
    t("Review participant waiver (legal review)", "Carla", "Week 1", "Month 1", "high"),
    t("Send ForageSF email announcement to past list", "Carla", "Week 1", "Month 1", "high"),
    t("Review private events page (check inquiry form)", "Carla", "Week 1", "Month 1", "normal"),
    t("Set up Google Analytics on foragebali.com", "Carla", "Week 1", "Month 1", "normal"),
    t("Research top 20 retreat centers near Ubud (list for Yuka)", "Carla", "Week 1", "Month 1", "normal", description="Yuka needs this by Week 3"),
    t("Reach out to Zola re: gift experience listing", "Carla", "Week 1", "Month 1", "normal", description="Also Honeyfund, Tinggly — start relationships now"),

    t("Draft brand voice doc + FAQ knowledge base", "Alex", "Week 1", "Month 1", "high"),
    t("Draft plant profile template (for Carla to fill)", "Alex", "Week 1", "Month 1", "normal"),
    t("SEO sweep: meta tags, OG images, structured data", "Alex", "Week 1", "Month 1", "normal"),

    # ── WEEK 2 (Mar 2–8) ──
    t("Set up Google OAuth for hello@foragebali.com", "Iso", "Week 2", "Month 1", "high"),
    t("Connect Bokun webhook → Supabase (fires on booking)", "Iso", "Week 2", "Month 1", "high"),
    t("WhatsApp API decision: 360dialog vs WATI ($64/mo)", "Iso", "Week 2", "Month 1", "high", description="360dialog preferred if viable, WATI as fallback"),
    t("Brief Carla on plant profile format", "Iso", "Week 2", "Month 1", "normal"),

    t("With Carla: identify Founding Foragers invite list", "Yuka", "Week 2", "Month 1", "high", description="Goal: 2 hotel concierges, 3 retreat operators, 2 micro-influencers, 3 expat foodies per class"),
    t("Flyer approved by Iso → get sample printed", "Yuka", "Week 2", "Month 1", "normal"),
    t("Blog: review 3 unpublished posts with Carla, schedule publication", "Yuka", "Week 2", "Month 1", "normal"),
    t("Instagram: 4 posts + 10 follows/day", "Yuka", "Week 2", "Month 1", "normal"),
    t("Confirm Made dates for 3 April free classes", "Yuka", "Week 2", "Month 1", "high"),

    t("TripAdvisor listing — create and optimize", "Carla", "Week 2", "Month 1", "normal"),
    t("Google Business Profile setup", "Carla", "Week 2", "Month 1", "normal"),
    t("Build hotel outreach list: top 20 hotels near Ubud", "Carla", "Week 2", "Month 1", "normal"),
    t("With Yuka: identify Founding Foragers invite list", "Carla", "Week 2", "Month 1", "high"),
    t("Create booking confirmation email template (logistics, what to bring)", "Carla", "Week 2", "Month 1", "high"),
    t("Plant profiles #1–3", "Carla", "Week 2", "Month 1", "normal"),
    t("Set up blog publishing workflow (review → publish → promote)", "Carla", "Week 2", "Month 1", "normal", description="Carla owns this going forward"),

    t("Connect Noko to email (hello@foragebali.com)", "Alex", "Week 2", "Month 1", "high"),
    t("Connect Noko to Supabase (direct client)", "Alex", "Week 2", "Month 1", "high"),
    t("Connect Noko to Google Drive (team knowledge base)", "Alex", "Week 2", "Month 1", "normal"),
    t("Bokun API: test availability queries", "Alex", "Week 2", "Month 1", "normal"),
    t("Draft WhatsApp confirmation message copy", "Alex", "Week 2", "Month 1", "normal"),

    # ── WEEK 3 (Mar 9–15) ──
    t("WhatsApp API setup (360dialog or WATI)", "Iso", "Week 3", "Month 1", "high"),
    t("Connect WhatsApp to OpenClaw/Noko", "Iso", "Week 3", "Month 1", "high"),
    t("Test: send 10 sample inquiries through Noko", "Iso", "Week 3", "Month 1", "high"),
    t("Review Noko's responses, adjust brand voice", "Iso", "Week 3", "Month 1", "normal"),
    t("Approve flyer final version for bulk print", "Iso", "Week 3", "Month 1", "normal"),

    t("Hotel visits: 5 hotels (introduce, leave flyer, relationship building)", "Yuka", "Week 3", "Month 1", "high"),
    t("Retreat visits: 3 retreats from Carla's list", "Yuka", "Week 3", "Month 1", "normal"),
    t("Blog post #1 published", "Yuka", "Week 3", "Month 1", "normal"),
    t("Begin outreach to Founding Foragers invite list", "Yuka", "Week 3", "Month 1", "high"),
    t("Instagram: 4 posts + 10 follows/day", "Yuka", "Week 3", "Month 1", "normal"),

    t("Viator — follow up on application status", "Carla", "Week 3", "Month 1", "normal"),
    t("Klook — follow up on application status", "Carla", "Week 3", "Month 1", "normal"),
    t("Airbnb Experiences — follow up on progress", "Carla", "Week 3", "Month 1", "normal"),
    t("Build retreat outreach list: 20 retreat centers", "Carla", "Week 3", "Month 1", "normal", description="Separate from hotels — for Yuka's visits"),
    t("Plant profiles #4–6", "Carla", "Week 3", "Month 1", "normal"),
    t("Mailchimp 5-step nurture sequence: draft + build", "Carla", "Week 3", "Month 1", "normal"),
    t("Coordinate with Yuka: what to bring/wear guest info", "Carla", "Week 3", "Month 1", "normal"),

    t("WhatsApp FAQ response flow live (availability, pricing, location, what to bring, cancellation, transport)", "Alex", "Week 3", "Month 1", "high"),
    t("WhatsApp escalation: 'human' keyword → ping Yuka on Slack", "Alex", "Week 3", "Month 1", "normal"),
    t("Multilingual detection live", "Alex", "Week 3", "Month 1", "normal"),

    # ── WEEK 4 (Mar 16–22) ──
    t("Build Bokun MCP: get_availability, get_booking, list_upcoming_classes, get_guest_info", "Iso", "Week 4", "Month 1", "high"),
    t("Test Noko calling Bokun MCP mid-conversation", "Iso", "Week 4", "Month 1", "high"),
    t("Review Founding Foragers invite list with Yuka", "Iso", "Week 4", "Month 1", "normal"),

    t("Hotel visits: 5 more (now with flyer)", "Yuka", "Week 4", "Month 1", "normal"),
    t("Retreat visits: 3 more relationship building", "Yuka", "Week 4", "Month 1", "normal"),
    t("Blog post #2 published", "Yuka", "Week 4", "Month 1", "normal"),
    t("Founding Foragers outreach: confirm attendance for April classes", "Yuka", "Week 4", "Month 1", "high"),
    t("Instagram: 4 posts + begin Reels (Walk With Made clips)", "Yuka", "Week 4", "Month 1", "normal"),
    t("Begin crossposting relevant ForageSF content", "Yuka", "Week 4", "Month 1", "normal"),

    t("Plant profiles #7–10", "Carla", "Week 4", "Month 1", "normal"),
    t("Publish blog posts from Yuka (own this workflow)", "Carla", "Week 4", "Month 1", "normal"),
    t("Bi-weekly call with Yuka (first one)", "Carla", "Week 4", "Month 1", "normal"),
    t("Follow up: GetYourGuide application", "Carla", "Week 4", "Month 1", "normal"),
    t("Research tour operators with large Bali email lists for cross-promotion", "Carla", "Week 4", "Month 1", "normal"),

    t("Bokun MCP live and tested", "Alex", "Week 4", "Month 1", "high"),
    t("Wire: new Bokun booking → Supabase guest record auto-created + language detected", "Alex", "Week 4", "Month 1", "high"),
    t("Source attribution: 'how did you hear about us?' auto-asked in pre-trip WhatsApp", "Alex", "Week 4", "Month 1", "normal"),

    # ══════════════════════════════════════════
    # MONTH 2 — LAUNCH (Mar 23 – Apr 20)
    # ══════════════════════════════════════════

    # ── WEEK 5 (Mar 23–29) ──
    t("Review + approve booking confirmation flow copy", "Iso", "Week 5", "Month 2", "high"),
    t("Approve first 5 plant profiles for site", "Iso", "Week 5", "Month 2", "normal"),
    t("Begin blog publishing dashboard build (Noko drafts → staff reviews → publishes)", "Iso", "Week 5", "Month 2", "normal", description="Multi-week build, not urgent"),

    t("Hotel visits: continue follow-ups on earlier contacts", "Yuka", "Week 5", "Month 2", "normal"),
    t("Retreat visits: follow up Week 3-4 contacts (relationship building)", "Yuka", "Week 5", "Month 2", "normal"),
    t("Founding Foragers: all 3 class dates confirmed with Made", "Yuka", "Week 5", "Month 2", "high", description="Suggest Apr 6, 13, 20"),
    t("Instagram: continue Reels + posts", "Yuka", "Week 5", "Month 2", "normal"),
    t("Blog post #3 published", "Yuka", "Week 5", "Month 2", "normal"),

    t("Plant profiles #11–14 + publish first 5 as Bali Wild Food Index", "Carla", "Week 5", "Month 2", "normal", description="One blog post per plant"),
    t("Draft review response templates (Google + TripAdvisor)", "Carla", "Week 5", "Month 2", "normal"),
    t("Mailchimp nurture sequence: test + go live", "Carla", "Week 5", "Month 2", "high"),
    t("Follow up Zola / Honeyfund / Tinggly outreach", "Carla", "Week 5", "Month 2", "normal"),
    t("Research corporate retreat planners in Bali (private events pipeline)", "Carla", "Week 5", "Month 2", "normal"),

    t("Booking confirmation flow live: Bokun fires → Noko sends WhatsApp confirmation", "Alex", "Week 5", "Month 2", "high"),
    t("7-day pre-trip WhatsApp message automated", "Alex", "Week 5", "Month 2", "high"),
    t("24-hr reminder WhatsApp message automated", "Alex", "Week 5", "Month 2", "high"),
    t("Data enrichment live on every new booking", "Alex", "Week 5", "Month 2", "normal"),

    # ── WEEK 6 (Mar 30 – Apr 5) ──
    t("Build Passport page template in Next.js: foragebali.com/journal/[slug]", "Iso", "Week 6", "Month 2", "high"),
    t("Wire Passport to Supabase (plant data, session data, photos)", "Iso", "Week 6", "Month 2", "high"),
    t("Design Passport social share card (Instagram/WhatsApp)", "Iso", "Week 6", "Month 2", "normal"),
    t("Continue blog publishing dashboard build", "Iso", "Week 6", "Month 2", "normal"),

    t("Founding Foragers class #1: Apr 6 (curated invite list only)", "Yuka", "Week 6", "Month 2", "high", description="Quality guests, photos, plant checklist, review ask at end"),
    t("Hotel/retreat: continue relationship building", "Yuka", "Week 6", "Month 2", "normal"),
    t("Blog post #4 in progress", "Yuka", "Week 6", "Month 2", "normal"),
    t("Instagram: continue posting", "Yuka", "Week 6", "Month 2", "normal"),

    t("Plant profiles #15–18 published", "Carla", "Week 6", "Month 2", "normal"),
    t("Set up weekly email newsletter in Mailchimp (Noko drafts, Carla reviews)", "Carla", "Week 6", "Month 2", "normal"),
    t("Draft private events package (pricing, inclusions) for Iso review", "Carla", "Week 6", "Month 2", "normal"),
    t("Bi-weekly call with Yuka", "Carla", "Week 6", "Month 2", "normal"),

    t("Guide input flow: Made sends photos + plant list via WhatsApp → Noko parses → session record in Supabase", "Alex", "Week 6", "Month 2", "high"),
    t("Post-trip thank you message automated", "Alex", "Week 6", "Month 2", "normal"),
    t("Day-2 review request automated", "Alex", "Week 6", "Month 2", "normal"),
    t("Weekly newsletter: Noko drafts first edition", "Alex", "Week 6", "Month 2", "normal"),

    # ── WEEK 7 (Apr 6–12) ──
    t("Handcraft Passport #1 manually — set quality bar", "Iso", "Week 7", "Month 2", "high"),
    t("Test guide WhatsApp input flow end-to-end", "Iso", "Week 7", "Month 2", "high"),
    t("Wire Passport auto-generation from guide input", "Iso", "Week 7", "Month 2", "high"),
    t("Continue blog publishing dashboard build", "Iso", "Week 7", "Month 2", "normal"),

    t("Founding Foragers class #2: Apr 13", "Yuka", "Week 7", "Month 2", "high"),
    t("Follow up Class #1 guests on reviews", "Yuka", "Week 7", "Month 2", "high"),
    t("Blog post #4 published", "Yuka", "Week 7", "Month 2", "normal"),
    t("Continue hotel/retreat visits + relationship building", "Yuka", "Week 7", "Month 2", "normal"),
    t("Instagram: continue", "Yuka", "Week 7", "Month 2", "normal"),

    t("Plant profiles #19–20 published (Bali Wild Food Index: 20 plants live ✓)", "Carla", "Week 7", "Month 2", "normal"),
    t("Monitor platform listing applications", "Carla", "Week 7", "Month 2", "normal"),
    t("Confirm pre-trip reminder emails are firing", "Carla", "Week 7", "Month 2", "normal"),
    t("First weekly newsletter sent (Noko draft → Carla review)", "Carla", "Week 7", "Month 2", "normal"),

    t("Passport automation live: Made submits via WhatsApp → page generates → link to guests within 24hrs", "Alex", "Week 7", "Month 2", "high"),
    t("Post-class photo flow: Slack #class-photos → Noko pulls emails → drafts thank-you → Carla reviews → sends", "Alex", "Week 7", "Month 2", "normal"),
    t("Day-7 referral nudge automated", "Alex", "Week 7", "Month 2", "normal"),

    # ── WEEK 8 (Apr 13–19) ──
    t("Staff dashboard v1: home.foragebali.com (bookings, revenue, upcoming classes, open inquiries)", "Iso", "Week 8", "Month 2", "high"),
    t("Review Passport quality from Class #1 — adjust", "Iso", "Week 8", "Month 2", "normal"),
    t("Continue blog publishing dashboard build", "Iso", "Week 8", "Month 2", "normal"),

    t("Founding Foragers class #3: Apr 20", "Yuka", "Week 8", "Month 2", "high"),
    t("Follow up Class #2 guests on reviews", "Yuka", "Week 8", "Month 2", "high"),
    t("Blog post #5 in progress", "Yuka", "Week 8", "Month 2", "normal"),
    t("Continue hotel/retreat visits", "Yuka", "Week 8", "Month 2", "normal"),
    t("Brainstorm new class types (cooking? market tour? jamu?)", "Yuka", "Week 8", "Month 2", "normal"),

    t("Begin corporate private events cold email", "Carla", "Week 8", "Month 2", "normal"),
    t("Follow up all platform listing applications", "Carla", "Week 8", "Month 2", "normal"),
    t("Confirm pre-trip emails all firing correctly", "Carla", "Week 8", "Month 2", "normal"),
    t("Review + send weekly newsletter (Noko draft)", "Carla", "Week 8", "Month 2", "normal"),
    t("Track bookings by source in Supabase", "Carla", "Week 8", "Month 2", "normal"),
    t("Research email list partnership opportunities", "Carla", "Week 8", "Month 2", "normal", description="Tour operators, retreat centers, travel bloggers"),

    t("Dashboard v1 live", "Alex", "Week 8", "Month 2", "high"),
    t("VIP flagging: media email domains, large groups, Instagram handles → alert to Slack", "Alex", "Week 8", "Month 2", "normal"),
    t("Weekly business report: first draft runs Monday AM", "Alex", "Week 8", "Month 2", "normal"),

    # ── WEEK 9 (Apr 20–26) — FIRST PAID CLASS ──
    t("Founding Foragers class #3: Apr 20 (wrap up beta)", "Iso", "Week 9", "Month 2", "high"),
    t("Be available for urgent issues on April 24 (first paid class)", "Iso", "Week 9", "Month 2", "high"),
    t("Watch Noko handle real inquiries live — note what needs adjustment", "Iso", "Week 9", "Month 2", "normal"),

    t("🎉 FIRST PAID CLASS: April 24", "Yuka", "Week 9", "Month 2", "high"),
    t("Full day-of coordination with Made (first paid class)", "Yuka", "Week 9", "Month 2", "high"),
    t("Guest pickup + logistics (first paid class)", "Yuka", "Week 9", "Month 2", "high"),
    t("Photos + plant checklist during class", "Yuka", "Week 9", "Month 2", "high"),
    t("Post-class: explicit review ask from guests", "Yuka", "Week 9", "Month 2", "normal"),

    t("Monitor all bookings + issues on launch day (Apr 24)", "Carla", "Week 9", "Month 2", "high"),
    t("Confirm confirmation emails went out", "Carla", "Week 9", "Month 2", "high"),
    t("Confirm pre-trip reminders fired", "Carla", "Week 9", "Month 2", "high"),
    t("Respond to any platform inquiries", "Carla", "Week 9", "Month 2", "normal"),
    t("Bi-weekly call with Yuka", "Carla", "Week 9", "Month 2", "normal"),

    t("Passport for first paid class: fully automated", "Alex", "Week 9", "Month 2", "high"),
    t("Review requests fire Day 2 automatically", "Alex", "Week 9", "Month 2", "high"),
    t("Weekly report delivered to Slack Monday AM", "Alex", "Week 9", "Month 2", "normal"),

    # ══════════════════════════════════════════
    # MONTH 3 — SCALE (Apr 27 – May 17)
    # ══════════════════════════════════════════

    # ── WEEK 10 (Apr 27 – May 3) ──
    t("Post-class debrief: what worked, what broke", "Iso", "Week 10", "Month 3", "high"),
    t("Dashboard v2: WhatsApp conversation view, review scores, source attribution", "Iso", "Week 10", "Month 3", "normal"),
    t("Review Noko inquiry → booking conversion rate", "Iso", "Week 10", "Month 3", "normal"),

    t("Collect reviews from Class #1 paid guests", "Yuka", "Week 10", "Month 3", "high"),
    t("Debrief with Made: what needs to change", "Yuka", "Week 10", "Month 3", "high"),
    t("Second teacher scouting begins", "Yuka", "Week 10", "Month 3", "normal"),
    t("Continue hotel/retreat relationship building", "Yuka", "Week 10", "Month 3", "normal"),
    t("Blog post #5 published", "Yuka", "Week 10", "Month 3", "normal"),
    t("Brainstorm new class types (cooking, market tour, jamu/medicinal)", "Yuka", "Week 10", "Month 3", "normal"),

    t("Research liability insurance (~$500–2k/year)", "Carla", "Week 10", "Month 3", "high"),
    t("Confirm tax obligations", "Carla", "Week 10", "Month 3", "high"),
    t("Review all platform listing statuses", "Carla", "Week 10", "Month 3", "normal"),
    t("First bookings-by-source report", "Carla", "Week 10", "Month 3", "normal"),
    t("Journalist outreach list: 20 names (food, travel, sustainable tourism)", "Carla", "Week 10", "Month 3", "normal"),
    t("Schedule upcoming April/May classes with Made", "Carla", "Week 10", "Month 3", "high"),

    t("Noko handles reschedule/cancellation requests (within policy, escalates edge cases)", "Alex", "Week 10", "Month 3", "normal"),
    t("Inquiry → booking conversion tracked in Supabase", "Alex", "Week 10", "Month 3", "normal"),
    t("Common questions log: flags unanswered questions → improves FAQ KB weekly", "Alex", "Week 10", "Month 3", "normal"),

    # ── WEEK 11 (May 4–10) ──
    t("Build cold email infrastructure for Noko (journalist outreach + private events drip)", "Iso", "Week 11", "Month 3", "high"),
    t("Finalize teacher agreement with Made", "Iso", "Week 11", "Month 3", "high"),
    t("Review + adjust weekly report format", "Iso", "Week 11", "Month 3", "normal"),
    t("Blog publishing dashboard: push toward v1", "Iso", "Week 11", "Month 3", "normal"),

    t("Classes running: confirm schedule with Made", "Yuka", "Week 11", "Month 3", "high"),
    t("Continue retreat relationship building", "Yuka", "Week 11", "Month 3", "normal"),
    t("Second teacher interviews begin", "Yuka", "Week 11", "Month 3", "normal"),
    t("Blog post #6 in progress", "Yuka", "Week 11", "Month 3", "normal"),
    t("Instagram: continue", "Yuka", "Week 11", "Month 3", "normal"),

    t("Journalist cold email campaign launches (Noko drafts, Carla personalizes + sends)", "Carla", "Week 11", "Month 3", "high"),
    t("Private events cold email campaign launches (3-email drip)", "Carla", "Week 11", "Month 3", "high"),
    t("Sign up for HARO (Featured.com) — free", "Carla", "Week 11", "Month 3", "normal"),
    t("Email list partnership outreach: 2-3 tour operators / retreat centers", "Carla", "Week 11", "Month 3", "normal"),
    t("Monthly revenue review", "Carla", "Week 11", "Month 3", "normal"),
    t("Bi-weekly call with Yuka", "Carla", "Week 11", "Month 3", "normal"),

    t("Journalist outreach: Noko monitors HARO, drafts pitches → human review before sending", "Alex", "Week 11", "Month 3", "high"),
    t("Private events: 3-email drip sequence live", "Alex", "Week 11", "Month 3", "normal"),
    t("Blog draft pipeline: voice memo → Noko transcribes + drafts → review queue → Carla approves → publishes", "Alex", "Week 11", "Month 3", "normal"),
    t("Weekly QA checklist automated (booking flow, WhatsApp, site, listings, reviews)", "Alex", "Week 11", "Month 3", "normal"),

    # ── WEEK 12 (May 11–17) ──
    t("3-month retrospective: what's working, what isn't", "Iso", "Week 12", "Month 3", "high"),
    t("Plan Q2 AI builds: Instagram automation, WebMCP, dashboard v3", "Iso", "Week 12", "Month 3", "normal"),
    t("Decide: second teacher — hire or not yet?", "Iso", "Week 12", "Month 3", "normal"),
    t("Decide: what new class types for Q2?", "Iso", "Week 12", "Month 3", "normal"),

    t("Classes running", "Yuka", "Week 12", "Month 3", "normal"),
    t("Retreat partnership #1: first guests sending (if relationship developed)", "Yuka", "Week 12", "Month 3", "normal"),
    t("Blog post #6 published", "Yuka", "Week 12", "Month 3", "normal"),
    t("Compile teacher criteria + onboarding doc", "Yuka", "Week 12", "Month 3", "normal"),
    t("Map out new class concepts for Q2", "Yuka", "Week 12", "Month 3", "normal"),

    t("Review all platform listing performance", "Carla", "Week 12", "Month 3", "normal"),
    t("Track partnership referrals vs direct bookings", "Carla", "Week 12", "Month 3", "normal"),
    t("Month 3 revenue review", "Carla", "Week 12", "Month 3", "high"),
    t("Partner commission tracking: first round", "Carla", "Week 12", "Month 3", "normal"),
    t("GDPR compliance: consent checkbox, privacy policy, data deletion procedure", "Carla", "Week 12", "Month 3", "normal"),
    t("Follow up Zola / gift platform conversations", "Carla", "Week 12", "Month 3", "normal"),

    t("Blog draft automation: fully running", "Alex", "Week 12", "Month 3", "high"),
    t("Post-trip photo email: fully automated", "Alex", "Week 12", "Month 3", "normal"),
    t("Passport: 12+ published, sharing metrics tracked", "Alex", "Week 12", "Month 3", "normal"),
    t("Dashboard full view: bookings, revenue, reviews, WhatsApp, email, Passport shares, source attribution", "Alex", "Week 12", "Month 3", "normal"),
]

def main():
    print(f"🌿 Forage Bali Seed Script — {len(TASKS)} tasks")

    # Delete all existing tasks
    print("\n🗑  Clearing existing tasks...")
    result = req("DELETE", "/tasks?id=neq.00000000-0000-0000-0000-000000000000")
    print("  Done.")

    # Insert in batches of 50
    batch_size = 50
    inserted = 0
    errors = 0
    for i in range(0, len(TASKS), batch_size):
        batch = TASKS[i:i+batch_size]
        print(f"\n📥 Inserting batch {i//batch_size + 1} ({len(batch)} tasks)...")
        result = req("POST", "/tasks", batch)
        if result is None:
            errors += len(batch)
            print(f"  ❌ Batch failed!")
        else:
            inserted += len(batch)
            print(f"  ✅ {inserted} tasks inserted so far")

    print(f"\n{'='*50}")
    print(f"✅ Done! {inserted} tasks inserted, {errors} errors")
    print(f"📊 Breakdown:")
    owners = {}
    weeks = {}
    months = {}
    for task in TASKS:
        owners[task["owner"]] = owners.get(task["owner"], 0) + 1
        weeks[task["week"]] = weeks.get(task["week"], 0) + 1
        months[task["month"]] = months.get(task["month"], 0) + 1
    for owner, count in sorted(owners.items()):
        print(f"  {owner}: {count} tasks")
    print(f"  By month: {dict(sorted(months.items()))}")

if __name__ == "__main__":
    main()
