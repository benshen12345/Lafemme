/* =====================================================================
   LaFemme — anonymous analytics
   ---------------------------------------------------------------------
   No cookies. No localStorage. No IP or user-agent stored.
   visit_id is random per PAGE LOAD and is never saved on the device,
   so it cannot follow a person from one visit to the next.

   SETUP: paste your Supabase project URL and anon key below.
   Until you do, this file quietly does nothing — the site still works.
   ===================================================================== */
(function () {
  const SUPABASE_URL      = "https://djrnozqgrkpbxoaebaeo.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqcm5venFncmtwYnhvYWViYWVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5MjI5ODcsImV4cCI6MjA5OTQ5ODk4N30.GRak9yFiaknsX5WVxQ_Zue70k5m-zOrpXcb2vBut5tA";

  if (SUPABASE_URL.indexOf("YOUR-PROJECT") !== -1) {
    window.__track = function () {};          // not configured yet — no-op
    return;
  }

  const ENDPOINT = SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/events";
  const visit_id = (crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
      }));
  const device = window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";

  let queue = [];
  let timer = null;

  function post(rows, canSplit) {
    return fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_ANON_KEY,
        "Authorization": "Bearer " + SUPABASE_ANON_KEY,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify(rows),
      keepalive: true
    }).then(function (res) {
      /* A batch is one INSERT: if a single row is malformed the server rejects all of
         them, and the rest of that batch is lost with it. That actually happened — a
         tracked field had no matching column, so every batch containing a search event
         was discarded along with the seven other events beside it.

         On a 4xx the server definitely stored nothing, so it's safe to split the batch
         and retry each half; the bad row ends up alone and only it is lost. Network
         failures are NOT retried — the insert may have succeeded before the connection
         dropped, and retrying would duplicate. */
      if (!res.ok && canSplit && res.status >= 400 && res.status < 500 && rows.length > 1) {
        var mid = Math.ceil(rows.length / 2);
        post(rows.slice(0, mid), true);
        post(rows.slice(mid), true);
      }
    }).catch(function () {});   // analytics must never break the site
  }

  function flush() {
    if (!queue.length) return;
    var rows = queue;
    queue = [];
    clearTimeout(timer); timer = null;
    // fetch with keepalive survives page unload AND can send the auth headers
    // (sendBeacon cannot set headers, so its requests were being rejected)
    post(rows, true);
  }

  window.__track = function (event_type, data) {
    try {
      queue.push(Object.assign({ visit_id, event_type, device }, data || {}));
      if (queue.length >= 8) return flush();
      if (!timer) timer = setTimeout(() => flush(), 2000);
    } catch (e) { /* ignore */ }
  };

  addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flush(); });
  addEventListener("pagehide", () => flush());

  window.__track("page_view");
})();
