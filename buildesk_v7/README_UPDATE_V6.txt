Buildesk Health Monitor v6 — Usage Table + Deep Analysis update

IMPORTANT: This patch contains only index.html and server.py. It does NOT include clients.json or report_cache.json.

Install:
1. Stop the existing app window.
2. Back up the entire existing buildesk_usage_monitor folder.
3. Extract this ZIP.
4. Copy index.html and server.py into the existing buildesk_usage_monitor folder and replace those two files only.
5. Keep your existing clients.json and report_cache.json. Do not overwrite either file.
6. Restart with start_windows.bat and press Ctrl+F5 in the browser.

Behavior:
- Portfolio usage table loads Today, 3 Day and 7 Day on Refresh analysis. 10 Day, 14 Day, 21 Day and 1 Month are fetched only when the row's Fetch report button is clicked. Clicking counts lists the matching accounts; View report requests that account's selected period report.
- Deep Analysis uses saved daily reports first and fetches missing days only when you press the explicit Deep analysis button. Missing account/day fetches run through a small four-worker pool, and failures are counted in the status line and shown in each account timeline. The output includes usage pattern, trend, per-day timeline, and CSV export. For ranges longer than 14 days, the usage line is grouped into 7-day averages (about 4–5 points for a month); shorter ranges show daily points.
- Saved History defaults to cache-only (no API calls). Fetch missing from API is a separate explicit action.
- Daily report payloads remain in report_cache.json. Account data remains in clients.json. The server now saves today's report for accounts missing a cached today report on startup, then repeats once after midnight while the app remains running. It skips account/day reports already cached. If the app is closed all day, it cannot capture that missed day retroactively; use explicit Deep Analysis only if you want to fetch missing historical dates.
- Theme button cycles Light, Night, and Dark. The UI uses --font-mono.
- Server safely ignores browser-aborted writes.

Checks: Python syntax, embedded JavaScript syntax, and endpoint smoke tests should be run before use. Live Buildesk API behavior has not been verified here.
