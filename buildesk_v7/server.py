import json, os, threading, urllib.parse, urllib.request, uuid, time as time_module
from datetime import date, datetime, timedelta
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(ROOT, "clients.json")
REPORT_CACHE = os.path.join(ROOT, "report_cache.json")
DEFAULT_ENDPOINT = "https://buildeskapi.azurewebsites.net/api/GetExecutiveAcitvitySummaryReport"
CALL_ENDPOINT = "https://buildeskapi.azurewebsites.net/api/GetCallLogReportCountUserwise"
BOOKING_DAYWISE_ENDPOINT = "https://buildeskapi.azurewebsites.net/api/GetDashboardBookingCountSummaryDaywise"
lock = threading.RLock()
cache_lock = threading.RLock()
# Metrics understood from the reports shared so far. Keep display metrics separate from the
# activity score so duplicated totals (e.g. outgoing + incoming vs TotalCall) aren't double-counted.
COUNT_METRICS = [
    "TotalCall", "TotalConnectedCall", "TotalOutGoingCall", "TotalIncomingCall",
    "IncomingUnAnswered", "OutgoingUnAnswered", "MissedCall", "RejectedCall",
    "TotalLeads", "OnlyLeadCount", "LeadCount", "FollowupCount", "MeetingsCount",
    "SiteVisitScheduledCount", "SiteVisitConductedCount", "NewLeadCount",
    "NewSitevisitCount", "SitevisitCompletedCount", "NewBookingCount", "BookingCount",
    "LeadLostCount", "CPAddedCount", "CPContactedCount", "CustomerCount", "ContactCount", "UnqualifiedCount", "CPCount"
]
SCORE_KEYS = ["TotalCall", "TotalLeads", "FollowupCount", "SiteVisitScheduledCount", "SiteVisitConductedCount", "MeetingsCount", "CustomerCount", "BookingCount", "CPAddedCount", "CPContactedCount", "LeadLostCount"]
CALL_KEYS = ["TotalCall", "TotalConnectedCall", "TotalOutGoingCall", "OutGoingCall", "TotalIncomingCall", "IncomingCall", "IncomingUnAnswered", "OutgoingUnAnswered", "MissedCall", "RejectedCall", "TotalDurationInSeconds", "OutGoingCallDurationInSeconds", "IncomingCallDurationInSeconds"]
CRM_KEYS = ["FollowupCount", "MeetingsCount", "SiteVisitScheduledCount", "SiteVisitConductedCount", "NewSitevisitCount", "SitevisitCompletedCount", "NewBookingCount", "BookingCount", "CPAddedCount", "CPContactedCount", "CustomerCount", "LeadLostCount"]


def clients_load():
    try:
        with open(DB, encoding="utf-8") as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def clients_save(data):
    tmp = DB + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DB)


_report_cache_mem = None
_report_cache_signature = None


def report_cache_load():
    """Load the large JSON cache once and reuse it until the file changes."""
    global _report_cache_mem, _report_cache_signature
    try:
        st = os.stat(REPORT_CACHE)
        signature = (st.st_mtime_ns, st.st_size)
        with cache_lock:
            if _report_cache_mem is not None and _report_cache_signature == signature:
                return _report_cache_mem
            with open(REPORT_CACHE, encoding="utf-8") as f:
                data = json.load(f)
            _report_cache_mem = data if isinstance(data, dict) else {}
            _report_cache_signature = signature
            return _report_cache_mem
    except (OSError, ValueError):
        with cache_lock:
            _report_cache_mem = {}
            _report_cache_signature = None
            return _report_cache_mem


def report_cache_save(data):
    global _report_cache_mem, _report_cache_signature
    tmp = REPORT_CACHE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    os.replace(tmp, REPORT_CACHE)
    st = os.stat(REPORT_CACHE)
    with cache_lock:
        _report_cache_mem = data
        _report_cache_signature = (st.st_mtime_ns, st.st_size)


def cache_key(c, api_key, start_day, end_day):
    return "|".join((str(c.get("id", "")), api_key, start_day, end_day))


def dashboard_id_from_url(url):
    try:
        p = urllib.parse.urlparse((url or "").strip())
        if p.scheme not in ("https", "http") or p.hostname not in ("app.buildesk.in", "www.app.buildesk.in"):
            return ""
        fragment_path = p.fragment.split("?", 1)[0].rstrip("/")
        parts = [x for x in fragment_path.split("/") if x]
        if "dashboard" in parts:
            i = parts.index("dashboard")
            if len(parts) > i + 1:
                return parts[i + 1]
        path_parts = [x for x in p.path.rstrip("/").split("/") if x]
        return path_parts[-1] if path_parts else ""
    except Exception:
        return ""


def public(c):
    return {"id": c["id"], "name": c["name"], "reportUrl": c.get("reportUrl", ""), "userCount": as_int(c.get("userCount", 0)), "salesExecutive": str(c.get("salesExecutive", "") or ""), "onboardingDate": str(c.get("onboardingDate", "") or ""), "hasKey": bool(c.get("apiKey"))}


def as_int(value):
    try:
        return int(float(value or 0))
    except (ValueError, TypeError, OverflowError):
        return 0


def clean_row(row):
    name = str(row.get("Executive") or row.get("User") or row.get("Name") or "Unknown").strip() or "Unknown"
    item = {"executive": name, "team": str(row.get("Team") or "").strip(), "raw": {}}
    for key in COUNT_METRICS:
        item[key] = as_int(row.get(key))
    # Durations are useful evidence but don't add duplicate durations to the score.
    item["totalDuration"] = str(row.get("TotalCallDuration") or row.get("StrTotalDuration") or "00:00:00")
    item["averageCallDuration"] = str(row.get("AverageTotalCallDuration") or "00:00:00")
    item["callLogSyncActive"] = row.get("IsCallLogSyncActive")
    item["lastCallLogSyncAt"] = row.get("LastCallLogSyncAt")
    item["sources"] = row.get("Sources") if isinstance(row.get("Sources"), list) else []
    item["bookings"] = max(item.get("BookingCount", 0), item.get("NewBookingCount", 0))
    # Similar report fields can overlap (e.g. TotalLeads and LeadCount), so use the
    # strongest available representation per activity family instead of summing duplicates.
    lead_activity = max(item.get("TotalLeads", 0), item.get("LeadCount", 0), item.get("OnlyLeadCount", 0), item.get("NewLeadCount", 0))
    scheduled_activity = max(item.get("SiteVisitScheduledCount", 0), item.get("NewSitevisitCount", 0))
    conducted_activity = max(item.get("SiteVisitConductedCount", 0), item.get("SitevisitCompletedCount", 0))
    item["callScore"] = item["TotalCall"]
    item["crmScore"] = lead_activity + item.get("FollowupCount", 0) + scheduled_activity + conducted_activity + item.get("MeetingsCount", 0) + item["bookings"] + item.get("CPAddedCount", 0) + item.get("CPContactedCount", 0) + item.get("CustomerCount", 0) + item.get("LeadLostCount", 0)
    item["activityScore"] = item["callScore"] + item["crmScore"]
    item["hasCalls"] = item["TotalCall"] > 0 or item["TotalConnectedCall"] > 0 or item["TotalOutGoingCall"] > 0 or item["TotalIncomingCall"] > 0
    item["hasCrmActivity"] = any(item.get(k, 0) > 0 for k in CRM_KEYS)
    item["leadOnly"] = max(item.get("TotalLeads", 0), item.get("LeadCount", 0), item.get("OnlyLeadCount", 0), item.get("NewLeadCount", 0)) > 0 and not item["hasCrmActivity"] and not item["hasCalls"]
    item["hasActivity"] = item["hasCalls"] or item["hasCrmActivity"]
    item["usageType"] = "Calls + CRM" if item["hasCalls"] and item["hasCrmActivity"] else "Calls only" if item["hasCalls"] else "CRM activity" if item["hasCrmActivity"] else "No tracked activity"
    return item


def request_buildesk_json(endpoint, api_key, start_day, end_day, milliseconds=False):
    from_suffix = "T00:00:00.000" if milliseconds else "T00:00:00"
    to_suffix = "T23:59:59.999" if milliseconds else "T23:59:59"
    params = {"FromDate": start_day + from_suffix, "ToDate": end_day + to_suffix}
    url = endpoint + ("&" if "?" in endpoint else "?") + "jsonData=" + urllib.parse.quote(json.dumps(params, separators=(",", ":")), safe="")
    req = urllib.request.Request(url, headers={"apikey": api_key, "Accept": "application/json", "User-Agent": "Buildesk-Health-Monitor/6.0"})
    with urllib.request.urlopen(req, timeout=25) as response:
        data = json.loads(response.read().decode("utf-8", "replace"))
    if not isinstance(data, dict) or not data.get("Success"):
        raise RuntimeError((data.get("Message") if isinstance(data, dict) else "Invalid API response") or "Buildesk API reported failure")
    return data


def fetch_booking_daywise(api_key, start_day, end_day):
    """Fetch authoritative booking counts and map day-of-month values to full dates.

    Buildesk's response supplies Days and Count arrays (often newest day first).
    Some responses omit zero-activity days, so fill the requested calendar range
    with zeroes while matching returned day numbers in chronological order.
    """
    data = request_buildesk_json(BOOKING_DAYWISE_ENDPOINT, api_key, start_day, end_day, milliseconds=True)
    payload = data.get("Data")
    if not isinstance(payload, dict) or not isinstance(payload.get("Days"), list) or not isinstance(payload.get("Count"), list):
        raise RuntimeError("Booking API returned an unexpected payload; expected Data.Days and Data.Count arrays.")
    days = payload.get("Days") or []
    counts = payload.get("Count") or []
    if len(days) != len(counts):
        raise RuntimeError("Booking API returned mismatched Days and Count arrays.")
    pairs = [(as_int(d), as_int(c)) for d, c in zip(days, counts)]
    first = datetime.strptime(start_day, "%Y-%m-%d").date()
    last = datetime.strptime(end_day, "%Y-%m-%d").date()
    expected_desc = []
    cur = last
    while cur >= first:
        expected_desc.append(cur)
        cur -= timedelta(days=1)

    def align(sequence):
        mapped = {d.isoformat(): 0 for d in expected_desc}
        idx = 0
        for day in expected_desc:
            if idx < len(sequence) and sequence[idx][0] == day.day:
                mapped[day.isoformat()] = sequence[idx][1]
                idx += 1
        return mapped if idx == len(sequence) else None

    # Try the documented newest-first order first, then accept oldest-first.
    mapped = align(pairs)
    if mapped is None:
        mapped = align(list(reversed(pairs)))
    if mapped is None:
        raise RuntimeError("Booking API day values could not be aligned to the requested date range.")
    return {"daily": dict(sorted(mapped.items())), "total": sum(mapped.values())}


def enrich_booking_report(report, api_key, start_day, end_day):
    """Attach daywise booking data without failing the other CRM metrics."""
    try:
        result = fetch_booking_daywise(api_key, start_day, end_day)
        total = result["total"]
        report["bookingDaily"] = result["daily"]
        report["bookingTotal"] = total
        report["bookingSource"] = "GetDashboardBookingCountSummaryDaywise"
        report["bookingWarning"] = ""
        report.setdefault("totals", {})["BookingCount"] = total
        report["totals"]["NewBookingCount"] = total
        report.setdefault("summary", {})["BookingCount"] = total
        report["summary"]["NewBookingCount"] = total
        report["_bookingDailyVersion"] = 1
    except Exception as exc:
        report.setdefault("bookingDaily", {})
        report["bookingSource"] = "Executive activity report fallback"
        report["bookingWarning"] = "Daywise booking API unavailable: " + str(exc)
        report["_bookingDailyVersion"] = 0
    return report


def fetch_report(c, start_day, end_day=None, persist=True):
    end_day = end_day or start_day
    datetime.strptime(start_day, "%Y-%m-%d")
    datetime.strptime(end_day, "%Y-%m-%d")
    endpoint = (c.get("endpoint") or DEFAULT_ENDPOINT).strip()
    p = urllib.parse.urlparse(endpoint)
    if p.scheme != "https" or p.hostname != "buildeskapi.azurewebsites.net":
        raise ValueError("The configured Buildesk API endpoint is invalid.")
    api_key = str(c.get("apiKey") or "").strip() or dashboard_id_from_url(c.get("reportUrl", ""))
    if not api_key:
        raise ValueError("The Report URL does not contain a readable dashboard ID. Please check the full Buildesk dashboard URL.")
    ck = cache_key(c, api_key, start_day, end_day)
    with cache_lock:
        cached = report_cache_load().get(ck)
    if isinstance(cached, dict) and cached.get("_cachedReport"):
        cached_report = cached["_cachedReport"]
        if cached_report.get("_bookingDailyVersion") == 1:
            return cached_report
        # Retry only the booking endpoint for an existing cached report; do not
        # refetch the executive activity and call reports just because bookings failed.
        cached_report = enrich_booking_report(dict(cached_report), api_key, start_day, end_day)
        if persist:
            with cache_lock:
                cache = report_cache_load(); cache[ck] = {"_cachedReport": cached_report}; report_cache_save(cache)
        return cached_report
    try:
        data = request_buildesk_json(endpoint, api_key, start_day, end_day)
    except Exception as e:
        raise RuntimeError("Buildesk API request failed: " + str(e)) from e

    payload = data.get("Data") or []
    rows = [clean_row(x) for x in payload if isinstance(x, dict)] if isinstance(payload, list) else []
    summary = {key: as_int(payload.get(key)) for key in COUNT_METRICS} if isinstance(payload, dict) else {}

    # Call logs come from a separate Buildesk endpoint. If that endpoint fails, keep the
    # CRM report valid and expose the call-report warning instead of marking the whole account API as failed.
    call_warning = ""
    try:
        call_data = request_buildesk_json(CALL_ENDPOINT, api_key, start_day, end_day)
        call_payload = call_data.get("Data") or []
        call_rows = [x for x in call_payload if isinstance(x, dict)] if isinstance(call_payload, list) else []
        by_name = {str(x.get("executive", "")).strip().casefold(): x for x in rows}
        for raw in call_rows:
            name = str(raw.get("Executive") or raw.get("User") or raw.get("Name") or "Unknown").strip()
            key = name.casefold()
            item = by_name.get(key)
            if item is None:
                item = clean_row({"Executive": name})
                rows.append(item); by_name[key] = item
            # Use the call report's explicit fields, rather than zero values from the CRM endpoint.
            for metric in ("TotalCall", "TotalConnectedCall", "TotalOutGoingCall", "OutGoingCall", "TotalIncomingCall", "IncomingCall", "IncomingUnAnswered", "OutgoingUnAnswered", "MissedCall", "RejectedCall", "TotalDurationInSeconds", "OutGoingCallDurationInSeconds", "IncomingCallDurationInSeconds"):
                if metric in raw:
                    item[metric] = as_int(raw.get(metric))
            item["totalDuration"] = str(raw.get("TotalCallDuration") or raw.get("StrTotalDuration") or item.get("totalDuration") or "00:00:00")
            item["averageCallDuration"] = str(raw.get("AverageTotalCallDuration") or item.get("averageCallDuration") or "00:00:00")
            item["callLogSyncActive"] = raw.get("IsCallLogSyncActive")
            item["lastCallLogSyncAt"] = raw.get("LastCallLogSyncAt")
            item["callScore"] = item["TotalCall"]
            item["hasCalls"] = any(item.get(k, 0) > 0 for k in ("TotalCall", "TotalConnectedCall", "TotalOutGoingCall", "OutGoingCall", "TotalIncomingCall", "IncomingCall"))
            item["hasActivity"] = item["hasCalls"] or item.get("hasCrmActivity", False)
            item["usageType"] = "Calls + CRM" if item["hasCalls"] and item.get("hasCrmActivity") else "Calls only" if item["hasCalls"] else "CRM activity" if item.get("hasCrmActivity") else "No tracked activity"
    except Exception as e:
        call_warning = "Call-log report unavailable: " + str(e)

    for item in rows:
        item["hasCrmActivity"] = any(item.get(k, 0) > 0 for k in CRM_KEYS)
        lead_count = max(item.get("TotalLeads", 0), item.get("LeadCount", 0), item.get("OnlyLeadCount", 0), item.get("NewLeadCount", 0))
        item["leadOnly"] = lead_count > 0 and not item["hasCrmActivity"] and not item.get("hasCalls", False)
        item["hasActivity"] = item.get("hasCalls", False) or item["hasCrmActivity"]
        item["crmScore"] = max(item.get("TotalLeads", 0), item.get("LeadCount", 0), item.get("OnlyLeadCount", 0), item.get("NewLeadCount", 0)) + sum(item.get(k, 0) for k in CRM_KEYS)
        item["activityScore"] = item.get("TotalCall", 0) + item["crmScore"]
    totals = {k: sum(x.get(k, 0) for x in rows) for k in COUNT_METRICS}
    for k, v in summary.items():
        if v and not totals.get(k): totals[k] = v
    total_calls = totals.get("TotalCall", 0)
    # Lead receipt alone is not proof the sales team used CRM. Meaningful usage includes
    # follow-ups, visits, bookings, other workflow actions, or call logs.
    crm_total = sum(totals.get(k, 0) for k in ("FollowupCount", "MeetingsCount", "SiteVisitScheduledCount", "SiteVisitConductedCount", "NewSitevisitCount", "SitevisitCompletedCount", "NewBookingCount", "BookingCount", "CPAddedCount", "CPContactedCount", "CustomerCount"))
    call_activity = any(totals.get(k, 0) > 0 for k in ("TotalCall", "TotalConnectedCall", "TotalOutGoingCall", "TotalIncomingCall", "OutGoingCall", "IncomingCall"))
    leads = max(totals.get("TotalLeads", 0), totals.get("LeadCount", 0), totals.get("OnlyLeadCount", 0), totals.get("NewLeadCount", 0))
    crm_activity = crm_total > 0
    lead_only = leads > 0 and not crm_activity and not call_activity
    scheduled_activity = max(totals.get("SiteVisitScheduledCount", 0), totals.get("NewSitevisitCount", 0))
    conducted_activity = max(totals.get("SiteVisitConductedCount", 0), totals.get("SitevisitCompletedCount", 0))
    booking_activity = max(totals.get("BookingCount", 0), totals.get("NewBookingCount", 0))
    crm_score = leads + totals.get("FollowupCount", 0) + scheduled_activity + conducted_activity + totals.get("MeetingsCount", 0) + booking_activity + totals.get("CPAddedCount", 0) + totals.get("CPContactedCount", 0) + totals.get("CustomerCount", 0) + totals.get("LeadLostCount", 0)
    score = total_calls + crm_score
    has_activity = call_activity or crm_activity
    # Count users who actually performed a follow-up/visit/booking/other action or call.
    active_users = sum(1 for x in rows if x.get("hasCalls") or any(x.get(k, 0) > 0 for k in ("FollowupCount", "MeetingsCount", "SiteVisitScheduledCount", "SiteVisitConductedCount", "NewSitevisitCount", "SitevisitCompletedCount", "NewBookingCount", "BookingCount", "CPAddedCount", "CPContactedCount", "CustomerCount")))
    for x in rows:
        x["hasProductiveActivity"] = bool(x.get("hasCalls") or any(x.get(k, 0) > 0 for k in ("FollowupCount", "MeetingsCount", "SiteVisitScheduledCount", "SiteVisitConductedCount", "NewSitevisitCount", "SitevisitCompletedCount", "NewBookingCount", "BookingCount", "CPAddedCount", "CPContactedCount", "CustomerCount")))
    report = {
        "startDate": start_day, "endDate": end_day, "date": start_day if start_day == end_day else None,
        "executives": rows, "executiveCount": len(rows), "activeExecutives": active_users, "activeCrmExecutives": active_users,
        "zeroActivityExecutives": sum(not x.get("hasProductiveActivity") for x in rows), "totals": totals,
        "activityScore": score, "crmActivityScore": crm_score, "hasActivity": has_activity, "hasCalls": call_activity,
        "hasCrmActivity": crm_activity, "leadOnly": lead_only,
        "usageType": "Calls + CRM" if call_activity and crm_activity else "Calls only" if call_activity else "Lead receiving but no activity" if lead_only else "CRM activity" if crm_activity else "No tracked activity",
        "summary": summary, "message": str(data.get("Message") or ""), "callReportWarning": call_warning,
        "note": "Lead receipt alone is classified separately; follow-ups, visits, bookings, other workflow actions, or call logs count as usage."
    }
    # Booking totals are sourced from the dedicated daywise dashboard API.
    # A failed booking call is surfaced separately and can be retried without
    # refetching the other reports.
    report = enrich_booking_report(report, api_key, start_day, end_day)
    if persist:
        with cache_lock:
            cache = report_cache_load(); cache[ck] = {"_cachedReport": report}; report_cache_save(cache)
    return report


def scan_one(c, start, end=None):
    try:
        r = fetch_report(c, start, end)
        return {"id": c["id"], "name": c["name"], "ok": True, "hasActivity": r["hasActivity"],
                "hasCalls": r["hasCalls"], "hasCrmActivity": r["hasCrmActivity"], "leadOnly": r.get("leadOnly", False), "usageType": r["usageType"],
                "activityScore": r["activityScore"], "crmActivityScore": r.get("crmActivityScore", 0), "activeExecutives": r["activeExecutives"], "activeCrmUsers": r.get("activeCrmExecutives", 0), "callReportWarning": r.get("callReportWarning", ""),
                "executiveCount": r["executiveCount"], "totals": r["totals"], "startDate": start, "endDate": end or start}
    except Exception as e:
        return {"id": c["id"], "name": c["name"], "ok": False, "error": str(e), "startDate": start, "endDate": end or start}


def scan_all(start, end=None):
    with lock: cs = list(clients_load())
    with ThreadPoolExecutor(max_workers=min(8, max(1, len(cs)))) as pool:
        results = list(pool.map(lambda c: scan_one(c, start, end), cs))
    ranked = sorted((x for x in results if x.get("ok") and x.get("hasActivity")), key=lambda x: x.get("activityScore", 0), reverse=True)
    rank_map = {x["id"]: i + 1 for i, x in enumerate(ranked)}
    for x in results:
        x["usageRank"] = rank_map.get(x["id"])
        if not x.get("ok"):
            x["usageTag"] = "API error"
        elif x.get("leadOnly"):
            x["usageTag"] = "Lead receiving, no activity"
        elif not x.get("hasActivity"):
            x["usageTag"] = "Not using CRM"
        elif x.get("usageRank") == 1:
            x["usageTag"] = "Most active"
        elif x.get("usageRank") == len(ranked) and len(ranked) > 1:
            x["usageTag"] = "Least active"
        elif x.get("hasCalls") and not x.get("hasCrmActivity"):
            x["usageTag"] = "Calls only"
        else:
            x["usageTag"] = "Using CRM"
    return {"startDate": start, "endDate": end or start, "totalClients": len(cs), "results": results,
            "active": sum(bool(x.get("ok") and x.get("hasActivity")) for x in results),
            "inactive": sum(bool(x.get("ok") and not x.get("hasActivity")) for x in results),
            "errors": sum(not x.get("ok") for x in results),
            "mostActive": ranked[0]["id"] if ranked else None,
            "leastActive": ranked[-1]["id"] if ranked else None}


def cached_report(c, day):
    """Return one cached single-day report without making an API request."""
    api_key = str(c.get("apiKey") or "").strip() or dashboard_id_from_url(c.get("reportUrl", ""))
    if not api_key:
        return None
    with cache_lock:
        item = report_cache_load().get(cache_key(c, api_key, day, day), {})
    report = item.get("_cachedReport") if isinstance(item, dict) else None
    return report if isinstance(report, dict) else None


def deep_analysis(start, end, fetch_missing=False):
    """Build per-account daily timelines from disk cache; fetch only when explicitly requested."""
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    if end_date < start_date:
        raise ValueError("End date must be on or after start date.")
    days = (end_date - start_date).days + 1
    if days > 366:
        raise ValueError("Choose a date range of 366 days or less.")
    with lock:
        cs = list(clients_load())
    results = []
    # Fetch only missing account/day reports when explicitly requested. Use a small worker
    # pool so a 14/21/30-day analysis completes in reasonable time without flooding the API.
    fetch_errors = {}
    if fetch_missing:
        tasks = []
        for c in cs:
            for i in range(days):
                day = (start_date + timedelta(days=i)).isoformat()
                cached = cached_report(c, day)
                if cached is None or cached.get("_bookingDailyVersion") != 1:
                    tasks.append((c, day))
        if tasks:
            def fetch_one(task):
                c, day = task
                try:
                    fetch_report(c, day)
                    return (c.get("id"), day, "")
                except Exception as e:
                    return (c.get("id"), day, str(e))
            with ThreadPoolExecutor(max_workers=min(4, len(tasks))) as pool:
                for cid, day, error in pool.map(fetch_one, tasks):
                    if error:
                        fetch_errors[(cid, day)] = error
    for c in cs:
        daily = []
        for i in range(days):
            day = (start_date + timedelta(days=i)).isoformat()
            report = cached_report(c, day)
            error = fetch_errors.get((c.get("id"), day), "")
            if report is None:
                daily.append({"date": day, "saved": False, "ok": False, "status": "Fetch failed" if error else "Not saved", "hasActivity": False, "hasCrmActivity": False, "leadOnly": False, "score": 0, "calls": 0, "leads": 0, "followups": 0, "visits": 0, "bookings": 0, "error": error})
                continue
            totals = report.get("totals") or {}
            has_activity = bool(report.get("hasActivity"))
            has_crm = bool(report.get("hasCrmActivity"))
            lead_only = bool(report.get("leadOnly"))
            status = "Using CRM" if has_activity else "Lead received, no activity" if lead_only else "Not using CRM"
            daily.append({"date": day, "saved": True, "ok": True, "status": status,
                "hasActivity": has_activity, "hasCrmActivity": has_crm, "leadOnly": lead_only,
                "score": as_int(report.get("crmActivityScore", report.get("activityScore", 0))),
                "calls": as_int(totals.get("TotalCall")),
                "leads": max(as_int(totals.get("TotalLeads")), as_int(totals.get("LeadCount")), as_int(totals.get("OnlyLeadCount")), as_int(totals.get("NewLeadCount"))),
                "followups": as_int(totals.get("FollowupCount")),
                "visits": max(as_int(totals.get("SiteVisitScheduledCount")), as_int(totals.get("SiteVisitConductedCount")), as_int(totals.get("NewSitevisitCount")), as_int(totals.get("SitevisitCompletedCount"))),
                "bookings": max(as_int(totals.get("BookingCount")), as_int(totals.get("NewBookingCount"))), "error": ""})
        saved = [d for d in daily if d["saved"]]
        active_days = sum(d["hasActivity"] for d in saved)
        crm_days = sum(d["hasCrmActivity"] for d in saved)
        lead_only_days = sum(d["leadOnly"] for d in saved)
        scores = [d["score"] for d in saved]
        if len(saved) < days:
            band = "Incomplete history"
        elif crm_days == days:
            band = "Daily CRM use"
        elif crm_days >= max(2, int(days * .6)):
            band = "Frequent use"
        elif crm_days > 0:
            band = "Intermittent use"
        elif lead_only_days:
            band = "Leads received, low adoption"
        else:
            band = "No CRM use"
        first_half = daily[:max(1, days // 2)]
        second_half = daily[days // 2:]
        first_avg = sum(d["score"] for d in first_half if d["saved"]) / max(1, sum(d["saved"] for d in first_half))
        second_avg = sum(d["score"] for d in second_half if d["saved"]) / max(1, sum(d["saved"] for d in second_half))
        delta = second_avg - first_avg
        trend = "Increasing" if delta > max(0.5, first_avg * .1) else "Decreasing" if delta < -max(0.5, first_avg * .1) else "Stable" if saved else "Insufficient data"
        results.append({"id": c["id"], "name": c["name"], "salesExecutive": c.get("salesExecutive", ""), "userCount": as_int(c.get("userCount", 0)),
            "onboardingDate": c.get("onboardingDate", ""), "days": days, "savedDays": len(saved), "missingDays": days-len(saved),
            "activeDays": active_days, "crmActiveDays": crm_days, "leadOnlyDays": lead_only_days,
            "totalScore": sum(scores), "totalCalls": sum(d["calls"] for d in saved), "totalLeads": sum(d["leads"] for d in saved),
            "totalFollowups": sum(d["followups"] for d in saved), "totalVisits": sum(d["visits"] for d in saved), "totalBookings": sum(d["bookings"] for d in saved),
            "usageBand": band, "trend": trend, "daily": daily})
    results.sort(key=lambda x: (x["crmActiveDays"], x["totalScore"]), reverse=True)
    return {"startDate": start, "endDate": end, "days": days, "fetchMissing": bool(fetch_missing), "totalClients": len(cs),
        "savedDailyReports": sum(x["savedDays"] for x in results), "expectedDailyReports": len(cs)*days,
        "missingDailyReports": sum(x["missingDays"] for x in results), "results": results}



def qbr_default_period(today=None):
    """Last three completed calendar months, not a partial current month."""
    today = today or date.today()
    first_this_month = today.replace(day=1)
    end = first_this_month - timedelta(days=1)
    first_prev_month = end.replace(day=1)
    start = (first_prev_month.replace(day=1) - timedelta(days=1)).replace(day=1)
    return start.isoformat(), end.isoformat()


def qbr_report(c, start, end, fetch_missing=False):
    start_date = datetime.strptime(start, "%Y-%m-%d").date()
    end_date = datetime.strptime(end, "%Y-%m-%d").date()
    if end_date < start_date:
        raise ValueError("End date must be on or after start date.")
    days = (end_date - start_date).days + 1
    if days > 120:
        raise ValueError("QBR period cannot exceed 120 days.")

    # Strictly account-scoped: never iterate over or fetch any other customer.
    missing = []
    for i in range(days):
        day = (start_date + timedelta(days=i)).isoformat()
        existing = cached_report(c, day)
        if existing is None or existing.get("_bookingDailyVersion") != 1:
            missing.append(day)
    fetch_errors = {}
    fetched_reports = {}
    if fetch_missing and missing:
        def fetch_day(day):
            try:
                return day, fetch_report(c, day, persist=False), ""
            except Exception as exc:
                return day, None, str(exc)
        with ThreadPoolExecutor(max_workers=min(4, len(missing))) as pool:
            for day, report, error in pool.map(fetch_day, missing):
                if error:
                    fetch_errors[day] = error
                elif report:
                    fetched_reports[day] = report
        if fetched_reports:
            api_key = str(c.get("apiKey") or "").strip() or dashboard_id_from_url(c.get("reportUrl", ""))
            with cache_lock:
                cache = report_cache_load()
                for day, report in fetched_reports.items():
                    cache[cache_key(c, api_key, day, day)] = {"_cachedReport": report}
                report_cache_save(cache)

    daily = []
    employee_map = {}
    totals = {k: 0 for k in COUNT_METRICS}
    module_keys = {
        "Leads": ["TotalLeads", "LeadCount", "OnlyLeadCount", "NewLeadCount"],
        "Calls": ["TotalCall"],
        "Follow-ups": ["FollowupCount"],
        "Tasks / Meetings": ["MeetingsCount"],
        "Site visits scheduled": ["SiteVisitScheduledCount", "NewSitevisitCount"],
        "Site visits conducted": ["SiteVisitConductedCount", "SitevisitCompletedCount"],
        "Bookings": ["BookingCount", "NewBookingCount"],
        "Channel partners": ["CPAddedCount", "CPContactedCount"],
        "Customers / Contacts": ["CustomerCount", "ContactCount"],
    }
    saved_days = active_days = lead_only_days = 0
    booking_warnings = []
    for i in range(days):
        day = (start_date + timedelta(days=i)).isoformat()
        report = cached_report(c, day)
        if not report:
            daily.append({"date": day, "saved": False, "error": fetch_errors.get(day, ""), "status": "Fetch failed" if day in fetch_errors else "Not saved", "leads": 0, "calls": 0, "followups": 0, "tasks": 0, "visitsScheduled": 0, "visitsConducted": 0, "bookings": 0, "activityScore": 0, "activeUsers": 0})
            continue
        saved_days += 1
        active_days += int(bool(report.get("hasActivity")))
        lead_only_days += int(bool(report.get("leadOnly")))
        t = report.get("totals") or {}
        if report.get("bookingWarning"):
            booking_warnings.append({"date": day, "warning": report.get("bookingWarning")})
        for key in COUNT_METRICS:
            totals[key] += as_int(t.get(key))
        day_leads = max(as_int(t.get("TotalLeads")), as_int(t.get("LeadCount")), as_int(t.get("OnlyLeadCount")), as_int(t.get("NewLeadCount")))
        day_calls = as_int(t.get("TotalCall"))
        day_followups = as_int(t.get("FollowupCount"))
        day_tasks = as_int(t.get("MeetingsCount"))
        day_sched = max(as_int(t.get("SiteVisitScheduledCount")), as_int(t.get("NewSitevisitCount")))
        day_done = max(as_int(t.get("SiteVisitConductedCount")), as_int(t.get("SitevisitCompletedCount")))
        day_bookings = max(as_int(t.get("BookingCount")), as_int(t.get("NewBookingCount")))
        active_user_count = 0
        for user in report.get("executives", []):
            name = str(user.get("executive") or "Unknown").strip() or "Unknown"
            u = employee_map.setdefault(name, {"name": name, "activeDays": 0, "activity": 0, "leads": 0, "calls": 0, "followups": 0, "tasks": 0, "visits": 0, "bookings": 0, "modules": {}})
            user_leads = max(as_int(user.get("TotalLeads")), as_int(user.get("LeadCount")), as_int(user.get("OnlyLeadCount")), as_int(user.get("NewLeadCount")))
            user_calls = as_int(user.get("TotalCall"))
            user_followups = as_int(user.get("FollowupCount"))
            user_tasks = as_int(user.get("MeetingsCount"))
            user_visits = max(as_int(user.get("SiteVisitScheduledCount")), as_int(user.get("NewSitevisitCount")), as_int(user.get("SiteVisitConductedCount")), as_int(user.get("SitevisitCompletedCount")))
            user_bookings = max(as_int(user.get("BookingCount")), as_int(user.get("NewBookingCount")))
            productive = user_calls + user_followups + user_tasks + user_visits + user_bookings
            if productive > 0:
                active_user_count += 1
                u["activeDays"] += 1
            u["activity"] += productive + user_leads
            u["leads"] += user_leads; u["calls"] += user_calls; u["followups"] += user_followups
            u["tasks"] += user_tasks; u["visits"] += user_visits; u["bookings"] += user_bookings
            for mod, keys in module_keys.items():
                val = max([as_int(user.get(k)) for k in keys] or [0])
                u["modules"][mod] = u["modules"].get(mod, 0) + val
        daily.append({"date": day, "saved": True, "status": "CRM active" if report.get("hasActivity") else "Lead received, no activity" if report.get("leadOnly") else "No recorded activity",
            "leads": day_leads, "calls": day_calls, "followups": day_followups, "tasks": day_tasks,
            "visitsScheduled": day_sched, "visitsConducted": day_done, "bookings": day_bookings,
            "activityScore": as_int(report.get("activityScore")), "activeUsers": active_user_count})

    modules = []
    for mod, keys in module_keys.items():
        count = max([totals.get(k, 0) for k in keys] or [0])
        users = sum(1 for u in employee_map.values() if u.get("modules", {}).get(mod, 0) > 0)
        modules.append({"name": mod, "activities": count, "activeUsers": users})
    modules.sort(key=lambda x: x["activities"], reverse=True)
    employees = sorted(employee_map.values(), key=lambda x: (x["activity"], x["activeDays"]), reverse=True)
    active_employees = sum(1 for u in employees if u["activity"] > 0)
    leads = sum(d["leads"] for d in daily if d["saved"])
    calls = sum(d["calls"] for d in daily if d["saved"])
    bookings = sum(d["bookings"] for d in daily if d["saved"])
    followups = sum(d["followups"] for d in daily if d["saved"])
    visits = sum(d["visitsScheduled"] + d["visitsConducted"] for d in daily if d["saved"])
    # Adoption/health is explicitly based on recorded CRM activity and data coverage.
    coverage = round(saved_days / days * 100, 1) if days else 0
    employee_adoption = round(active_employees / max(1, as_int(c.get("userCount", 0))) * 100, 1) if c.get("userCount") else None
    first = daily[:max(1, len(daily)//2)]; second = daily[len(daily)//2:]
    first_avg = sum(x["activityScore"] for x in first if x["saved"]) / max(1, sum(x["saved"] for x in first))
    second_avg = sum(x["activityScore"] for x in second if x["saved"]) / max(1, sum(x["saved"] for x in second))
    delta = second_avg - first_avg
    trend = "Increasing" if delta > max(1, first_avg * .1) else "Decreasing" if delta < -max(1, first_avg * .1) else "Stable" if saved_days else "Insufficient data"
    return {"client": public(c), "startDate": start, "endDate": end, "days": days,
        "savedDays": saved_days, "missingDays": days-saved_days, "coveragePercent": coverage,
        "activeDays": active_days, "leadOnlyDays": lead_only_days, "activeEmployees": active_employees,
        "licensedUsers": as_int(c.get("userCount", 0)), "employeeAdoptionPercent": employee_adoption,
        "totals": {"leads": leads, "calls": calls, "followups": followups, "tasks": sum(d["tasks"] for d in daily if d["saved"]),
            "visitsScheduled": sum(d["visitsScheduled"] for d in daily if d["saved"]), "visitsConducted": sum(d["visitsConducted"] for d in daily if d["saved"]),
            "bookings": bookings, "activityScore": sum(d["activityScore"] for d in daily if d["saved"])},
        "trend": trend, "modules": modules, "employees": employees, "daily": daily,
        "bookingWarnings": booking_warnings,
        "bookingSource": "GetDashboardBookingCountSummaryDaywise",
        "recommendations": _qbr_recommendations(leads, calls, followups, visits, bookings, active_employees, as_int(c.get("userCount", 0)), modules, trend),
        "fetchMissingRequested": bool(fetch_missing), "fetchErrors": fetch_errors}


def _qbr_recommendations(leads, calls, followups, visits, bookings, active_users, licensed, modules, trend):
    out = []
    if leads and calls < leads * .25:
        out.append({"priority": "High", "finding": "Lead volume is not matched by recorded call activity", "action": "Review lead assignment, first-contact discipline and call logging with the sales manager."})
    if leads and followups < leads * .25:
        out.append({"priority": "High", "finding": "Recorded follow-up activity is low relative to lead volume", "action": "Introduce a follow-up cadence and review overdue or untouched leads."})
    if licensed and active_users < licensed * .5:
        out.append({"priority": "High", "finding": "Fewer than half of licensed users recorded productive CRM activity", "action": "Run role-based refresher training and agree on adoption expectations with the account admin."})
    if visits == 0 and leads:
        out.append({"priority": "Medium", "finding": "No site-visit activity was recorded in the selected period", "action": "Confirm whether site visits are relevant to this workflow and reinforce recording when applicable."})
    if bookings == 0 and leads:
        out.append({"priority": "Medium", "finding": "No bookings were recorded in the selected period", "action": "Review the booking workflow and confirm whether booking data is being entered in CRM."})
    low = [m["name"] for m in modules if m["activities"] == 0]
    if low:
        out.append({"priority": "Medium", "finding": "No activity recorded in: " + ", ".join(low[:4]), "action": "Validate subscription entitlement and workflow relevance, then provide targeted enablement if applicable."})
    if trend == "Decreasing":
        out.append({"priority": "High", "finding": "Recorded activity is trending down within the period", "action": "Arrange a customer health check to identify process, staffing or product blockers."})
    if not out:
        out.append({"priority": "Low", "finding": "No major adoption warning was detected from the available metrics", "action": "Maintain the current workflow and agree on one feature-adoption improvement for the next quarter."})
    return out


def daily_snapshot_loop():
    """Persist a current-day report once per calendar day while the local server is running.
    Existing cached daily reports are reused, so only missing account/day entries call the API.
    """
    while True:
        day = date.today().isoformat()
        with lock:
            cs = list(clients_load())
        missing = [c for c in cs if cached_report(c, day) is None]
        if missing:
            print(f"Daily snapshot: fetching missing reports for {len(missing)} account(s) on {day}.")
            with ThreadPoolExecutor(max_workers=min(6, max(1, len(missing)))) as pool:
                outcomes = list(pool.map(lambda c: scan_one(c, day), missing))
            errors = sum(not x.get("ok") for x in outcomes)
            print(f"Daily snapshot saved {len(outcomes)-errors}/{len(outcomes)} account report(s); {errors} error(s).")
        else:
            print(f"Daily snapshot: all {len(cs)} account report(s) already saved for {day}; no API calls needed.")
        tomorrow = datetime.combine(date.today() + timedelta(days=1), datetime.min.time())
        seconds = max(60, (tomorrow - datetime.now()).total_seconds() + 30)
        time_module.sleep(seconds)


class Handler(BaseHTTPRequestHandler):
    def sendj(self, status, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body))); self.send_header("Cache-Control", "no-store")
        try:
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError):
            # Browser navigation/refresh may cancel an in-flight request. Do not attempt
            # to write a second response to a disconnected socket.
            return

    def do_GET(self):
        u = urllib.parse.urlparse(self.path); q = urllib.parse.parse_qs(u.query)
        if u.path == "/":
            with open(os.path.join(ROOT, "index.html"), "rb") as f: body = f.read()
            self.send_response(200); self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body); return
        if u.path == "/api/clients":
            with lock: cs = clients_load()
            self.sendj(200, {"clients": [public(c) for c in cs]}); return
        if u.path in ("/api/scan", "/api/period-scan"):
            try:
                end = (q.get("date") or [date.today().isoformat()])[0]; datetime.strptime(end, "%Y-%m-%d")
                if u.path == "/api/scan": start = end
                else:
                    days = int((q.get("days") or ["7"])[0])
                    if days not in (1, 3, 7, 10, 14, 15, 21, 30): raise ValueError("Choose a supported period: 1, 3, 7, 10, 14, 15, 21, or 30 days.")
                    start = (datetime.strptime(end, "%Y-%m-%d").date() - timedelta(days=days - 1)).isoformat()
                self.sendj(200, scan_all(start, end)); return
            except Exception as e: self.sendj(400, {"error": str(e)}); return
        if u.path == "/api/usage-analysis":
            try:
                end = (q.get("date") or [date.today().isoformat()])[0]; datetime.strptime(end, "%Y-%m-%d")
                days = int((q.get("days") or ["7"])[0])
                if days not in (1, 3, 7, 10, 14, 15, 21, 30): raise ValueError("Choose 1, 3, 7, 10, 14, 15, 21, or 30 days.")
                start_date = datetime.strptime(end, "%Y-%m-%d").date() - timedelta(days=days - 1)
                start = start_date.isoformat()
                with lock: cs = list(clients_load())
                jobs = [(c, (start_date + timedelta(days=i)).isoformat()) for c in cs for i in range(days)]
                def daily_job(job):
                    c, day = job
                    try:
                        r = fetch_report(c, day)
                        return {"id": c["id"], "day": day, "ok": True, "hasActivity": r["hasActivity"], "hasCrmActivity": r["hasCrmActivity"], "activityScore": r["activityScore"], "crmActivityScore": r.get("crmActivityScore", 0), "totals": r["totals"]}
                    except Exception as e:
                        return {"id": c["id"], "day": day, "ok": False, "error": str(e), "hasActivity": False, "hasCrmActivity": False, "activityScore": 0, "totals": {}}
                with ThreadPoolExecutor(max_workers=min(16, max(1, len(jobs)))) as pool:
                    daily = list(pool.map(daily_job, jobs))
                by_id = {}
                for item in daily:
                    a = by_id.setdefault(item["id"], {"id": item["id"], "days": days, "activeDays": 0, "crmActiveDays": 0, "totalScore": 0, "okDays": 0, "errors": 0, "totals": {k: 0 for k in COUNT_METRICS}})
                    if item["ok"]:
                        a["okDays"] += 1
                        a["activeDays"] += int(item["hasActivity"])
                        a["crmActiveDays"] += int(item["hasCrmActivity"])
                        a["totalScore"] += item.get("crmActivityScore", item["activityScore"])
                        for k, v in item["totals"].items(): a["totals"][k] = a["totals"].get(k, 0) + v
                    else: a["errors"] += 1
                results = []
                for c in cs:
                    a = by_id[c["id"]]; a["name"] = c["name"]; a["userCount"] = as_int(c.get("userCount", 0))
                    a["status"] = "API error" if a["okDays"] == 0 else "Daily CRM user" if a["crmActiveDays"] == days else "Frequent" if a["crmActiveDays"] >= max(2, days * .6) else "Occasional" if a["crmActiveDays"] > 0 else "No CRM activity"
                    a["usageBand"] = "Daily use" if a["crmActiveDays"] == days else "Frequent use" if a["crmActiveDays"] >= max(2, days * .6) else "2–3 days use" if 2 <= a["crmActiveDays"] <= 3 else "Low use" if a["crmActiveDays"] > 0 else "No CRM use"
                    results.append(a)
                results.sort(key=lambda x: (x["crmActiveDays"], x["totalScore"]), reverse=True)
                self.sendj(200, {"startDate": start, "endDate": end, "days": days, "totalClients": len(cs), "results": results, "dailyChecks": len(daily), "errors": sum(x["errors"] for x in results)})
                return
            except Exception as e: self.sendj(400, {"error": str(e)}); return
        if u.path == "/api/continuous-scan":
            try:
                end = (q.get("date") or [date.today().isoformat()])[0]; datetime.strptime(end, "%Y-%m-%d")
                days = int((q.get("days") or ["3"])[0])
                if days not in (3, 7): raise ValueError("Choose 3 or 7 days.")
                end_date = datetime.strptime(end, "%Y-%m-%d").date()
                start_date = end_date - timedelta(days=days - 1)
                with lock: cs = list(clients_load())
                with cache_lock: cache = report_cache_load()
                results = []
                for c in cs:
                    api_key = str(c.get("apiKey") or "").strip() or dashboard_id_from_url(c.get("reportUrl", ""))
                    reports = []
                    for i in range(days):
                        day = (start_date + timedelta(days=i)).isoformat()
                        item = cache.get(cache_key(c, api_key, day, day), {}) if api_key else {}
                        report = item.get("_cachedReport") if isinstance(item, dict) else None
                        if isinstance(report, dict): reports.append({"day": day, "ok": True, "hasActivity": bool(report.get("hasActivity")), "leadOnly": bool(report.get("leadOnly"))})
                        else: reports.append({"day": day, "ok": False, "hasActivity": False, "leadOnly": False})
                    complete = all(x["ok"] for x in reports)
                    results.append({"id": c["id"], "name": c["name"], "days": days, "complete": complete,
                        "activeEveryDay": complete and all(x["hasActivity"] for x in reports),
                        "inactiveEveryDay": complete and all(not x["hasActivity"] and not x["leadOnly"] for x in reports),
                        "leadOnlyAnyDay": complete and any(x["leadOnly"] for x in reports),
                        "availableDays": sum(x["ok"] for x in reports)})
                self.sendj(200, {"startDate": start_date.isoformat(), "endDate": end, "days": days, "results": results,
                    "completeAccounts": sum(x["complete"] for x in results), "incompleteAccounts": sum(not x["complete"] for x in results)})
                return
            except Exception as e: self.sendj(400, {"error": str(e)}); return
        if u.path == "/api/deep-analysis":
            try:
                start = (q.get("start") or [""])[0]
                end = (q.get("end") or [""])[0]
                if not start or not end: raise ValueError("Choose a start and end date.")
                fetch_missing = (q.get("fetch") or ["0"])[0] == "1"
                self.sendj(200, deep_analysis(start, end, fetch_missing)); return
            except Exception as e:
                self.sendj(400, {"error": str(e)}); return
        if u.path == "/api/qbr":
            try:
                cid = (q.get("id") or [""])[0]
                start = (q.get("start") or [""])[0]
                end = (q.get("end") or [""])[0]
                if not start or not end:
                    start, end = qbr_default_period()
                with lock: cs = list(clients_load())
                c = next((x for x in cs if x.get("id") == cid), None)
                if not c: self.sendj(404, {"error": "Client not found"}); return
                fetch_missing = (q.get("fetch") or ["0"])[0] == "1"
                self.sendj(200, qbr_report(c, start, end, fetch_missing)); return
            except Exception as e:
                self.sendj(400, {"error": str(e)}); return
        if u.path == "/api/account-analysis":
            try:
                cid = (q.get("id") or [""])[0]
                start = (q.get("start") or [""])[0]
                end = (q.get("end") or [""])[0]
                if not start or not end: raise ValueError("Choose a start and end date.")
                with lock: cs = list(clients_load())
                c = next((x for x in cs if x.get("id") == cid), None)
                if not c: self.sendj(404, {"error": "Client not found"}); return
                fetch_missing = (q.get("fetch") or ["0"])[0] == "1"
                result = qbr_report(c, start, end, fetch_missing)
                self.sendj(200, result); return
            except Exception as e:
                self.sendj(400, {"error": str(e)}); return
        if u.path == "/api/report-range":
            cid = (q.get("id") or [""])[0]
            start = (q.get("start") or [""])[0]
            end = (q.get("end") or [""])[0]
            with lock: cs = clients_load()
            c = next((x for x in cs if x.get("id") == cid), None)
            if not c: self.sendj(404, {"error": "Client not found"}); return
            try:
                report = fetch_report(c, start, end)
                report["client"] = public(c)
                self.sendj(200, report)
            except Exception as e:
                self.sendj(502, {"error": str(e)})
            return
        if u.path == "/api/report":
            cid = (q.get("id") or [""])[0]; day = (q.get("date") or [date.today().isoformat()])[0]
            with lock: cs = clients_load()
            c = next((x for x in cs if x.get("id") == cid), None)
            if not c: self.sendj(404, {"error": "Client not found"}); return
            try:
                report = fetch_report(c, day); report["client"] = public(c); self.sendj(200, report)
            except Exception as e: self.sendj(502, {"error": str(e)})
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != "/api/clients": self.send_error(404); return
        try:
            n = int(self.headers.get("Content-Length", "0")); x = json.loads(self.rfile.read(n) or b"{}")
            name = str(x.get("name", "")).strip(); cid = str(x.get("id", "")).strip(); report_url = str(x.get("reportUrl", "")).strip(); user_count = as_int(x.get("userCount", 0)); sales_executive = str(x.get("salesExecutive", "") or "").strip(); onboarding_date = str(x.get("onboardingDate", "") or "").strip()
            if not name: raise ValueError("Client name is required.")
            if not report_url: raise ValueError("Report URL is required.")
            dashboard_id = dashboard_id_from_url(report_url)
            if not dashboard_id: raise ValueError("Paste the full Buildesk dashboard Report URL, including its dashboard ID.")
            with lock:
                cs = clients_load(); old = next((c for c in cs if c.get("id") == cid), None) if cid else None
                key = (old or {}).get("apiKey") or dashboard_id
                obj = {"id": cid or uuid.uuid4().hex, "name": name, "reportUrl": report_url, "userCount": user_count, "salesExecutive": sales_executive, "onboardingDate": onboarding_date, "endpoint": DEFAULT_ENDPOINT, "apiKey": key}
                if old: cs[cs.index(old)] = obj
                else: cs.append(obj)
                clients_save(cs)
            self.sendj(200, {"success": True, "client": public(obj)})
        except Exception as e: self.sendj(400, {"error": str(e)})

    def do_DELETE(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query); cid = (q.get("id") or [""])[0]
        with lock:
            cs = clients_load(); clients_save([c for c in cs if c.get("id") != cid])
        self.sendj(200, {"success": True})

    def log_message(self, *args): pass

if __name__ == "__main__":
    print("Buildesk Health Monitor v6: open http://127.0.0.1:8765 (keep this window open).")
    print("Automatic all-account API snapshots are disabled. Use explicit fetch actions in the dashboard.")
    ThreadingHTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
