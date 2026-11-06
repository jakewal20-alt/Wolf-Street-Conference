# Forecast feed: read-only conferences endpoint

Forecast reads Hallway's upcoming conferences, and their speakers, through this endpoint. It replaces Forecast's use of Hallway's Supabase service-role key.

## Endpoint

```
GET https://idsuahhfpkxylfmuidto.supabase.co/functions/v1/forecast-conferences
Authorization: Bearer <FORECAST_API_TOKEN>
```

Optional parameter: `include_past_days=N` (0–365, default 0). This also returns conferences that ended in the last N days.

| Status | Meaning |
|---|---|
| 200 | OK |
| 401 | Missing or wrong token |
| 405 | Not a GET request |
| 503 | `FORECAST_API_TOKEN` isn't set on the server; the endpoint is disabled |
| 500 | Query failed |

## Response

```json
{
  "generated_at": "2026-11-07T15:04:05.000Z",
  "count": 2,
  "conferences": [
    {
      "id": "uuid",
      "name": "I/ITSEC 2026",
      "start_date": "2026-11-30",
      "end_date": "2026-12-04",
      "location": "Orlando, FL",
      "description": "…",
      "exec_summary": { "…": "AI executive summary JSON, or null" },
      "tags": ["modeling and simulation", "…"],
      "source_url": "https://www.iitsec.org/",
      "updated_at": "2026-11-05T…",
      "speakers": [
        {
          "name": "Jane Doe",
          "title": "Program Manager",
          "organization": "PEO STRI",
          "session_title": "Keynote: …",
          "session_time": "Dec 1, 9:00 AM",
          "source_url": "https://www.iitsec.org/…",
          "extracted_at": "2026-11-07T…"
        }
      ]
    }
  ]
}
```

- **Upcoming** means the conference's end date (or start date, if there's no end date) is today or later in UTC, and it isn't archived.
- Dates are normalized to `YYYY-MM-DD`. They're stored as text in Hallway, so a conference whose dates can't be read is left out.
- `session_time` is passed through exactly as the website wrote it.
- **Never returned:** leads, contacts, notes, voice recaps, attendees or user data.

## Setting the token (Jake)

Run this command in Terminal from the Hallway repo. The token goes straight into Supabase and your clipboard, and never appears on screen:

```sh
T=$(openssl rand -hex 32) && supabase secrets set FORECAST_API_TOKEN="$T" --project-ref idsuahhfpkxylfmuidto && printf %s "$T" | pbcopy && unset T
```

Then paste it into Forecast's `.env` (for example as `HALLWAY_FEED_TOKEN=`). Once Forecast has switched to the endpoint, remove `WOLFSTREET_SUPABASE_KEY` from Forecast's `.env`.

To rotate the token, run the same command again and update Forecast's `.env`.

## Later: separate customer companies

When Hallway gets organizations, each token will be tied to one organization (for example `FORECAST_ORG_ID`), and the feed will return only that organization's conferences.
