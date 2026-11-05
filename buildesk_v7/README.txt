BUILDESK HEALTH MONITOR — VERSION 6

WHAT CHANGED
- Sidebar account rows show active CRM users / licensed users (e.g. 5/10), today's leads, and today's follow-ups. The old calls/leads/activity-score text is removed.
- Account status tags are based on CRM actions, not call volume alone. Calls remain visible as separate metrics.
- Added a Licensed CRM user count field to Add/Edit Account.
- Added sidebar search and three navigation areas: All Accounts, User by list, and Analysis.
- User by list groups accounts into 1–5, 6–10, 11–19, and 20+ licensed-user tabs. It shows whether each account had CRM activity during the last 7 days.
- Removed the separate Most active / Least active account panels and the Usage mode column.
- All Accounts Overview now includes a selected usage window (1, 3, 7, 10, 15, or 30 days), plus Today using CRM, Today no activity, 3-day using CRM, selected-window using CRM, and selected-window no CRM activity cards. Cards filter the account table.
- Overview columns are ordered as client, health/rank tag, active users, leads, follow-ups, visits scheduled/conducted, bookings, calls, connected calls, activity score, and Customer Success focus.
- Individual account detail shows leads, follow-ups, active CRM users, scheduled visits, conducted visits, bookings, then calls and connected calls. User table places call metrics at the end and removes activity score and Customer Success focus per user.
- Most active / least active CRM user panels remain in individual account detail.
- Analysis menu checks each day separately to identify daily use, frequent use, 2–3 days use, low use, or no CRM use over 1, 3, 7, 10, 15, or 30 days.
- Add Account modal now stays open if you click outside; use the X or Cancel button to close it.
- API failures remain distinct from inactivity.

RUN ON WINDOWS
1. Extract the ZIP into a private folder.
2. Install Python 3.10+ if it is not already installed.
3. Double-click start_windows.bat and keep its window open.
4. Open http://127.0.0.1:8765 in Chrome.
5. Add each account with its full Buildesk dashboard Report URL and licensed CRM user count.
6. Click Refresh analysis.

IMPORTANT: REPORT COVERAGE AND PERFORMANCE
- The configured endpoint is GetExecutiveAcitvitySummaryReport. It is the only verified report endpoint from the supplied details. Separate lead-by-user/source and summary KPI reports cannot be safely queried until their actual Request URLs and request payloads are known.
- The Analysis menu performs one daily report request per account per day. For 92 accounts over 30 days this can mean up to 2,760 report requests and may take a while or encounter API rate limits. Start with 7 days to validate.
- The app's current user-level active count relies on activity returned by this endpoint. It does not prove a user logged in, and it may not represent every CRM action.
- This prototype extracts the dashboard ID from the report URL and uses it as the API key, matching the earlier version's assumption. If the API requires a different key, live requests may fail until that key is configured locally. No live API access has been verified by packaging this ZIP.
- Account configuration is stored in clients.json. Keep this folder private and do not expose the local app publicly.


--- V7 UPGRADE ---
See UPGRADE_NOTES_V7.txt for the new QBR workflow, account-scoped fetching, and data limitations.
The QBR module is available in the left navigation. It defaults to the last three completed calendar months.

BOOKING COUNT NOTE
Booking totals now use the dedicated Buildesk daywise booking endpoint. The endpoint returns account-level daily counts, which are mapped to calendar dates and used in account KPIs, deep analysis, and QBR. If the booking endpoint is unavailable, the dashboard displays a warning rather than treating the failure as a confirmed zero. Employee-wise booking attribution still depends on the executive activity report.
