# Free Tier Estimate

Pricing references checked on 2026-05-17:

- Cloudflare Workers: https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Cloudflare D1: https://developers.cloudflare.com/d1/platform/pricing/

## Current Backend Cost Shape

Open Puzzle keeps images out of backend storage. Images are resized in the browser and shared peer-to-peer through WebRTC DataChannels, so backend usage is mostly room metadata, WebSocket signaling, and small lifecycle event rows.

Per room, the expected D1 writes are roughly:

- 1 room row on create.
- 1 event row on create.
- 1 room update and 1 event row for each participant join.
- 1 room update and 1 event row for each participant leave.
- Optional event rows for participant rename.
- Cleanup deletes the room row and its matching event rows after the retention window.

With the default `MAX_PARTICIPANTS=6`, a full room with no renames uses about 15 initial lifecycle writes, then about 8 cleanup writes. That is about 23 D1 row writes per completed room, before index maintenance. The `room_events_room_id_idx` index adds write work for event inserts and deletes, but keeps cleanup from scanning the full event table.

Durable Object request usage is driven by room WebSocket connection requests plus signaling messages. Actual puzzle image and board sync traffic is peer-to-peer after WebRTC connects.

## Free Tier Capacity

Cloudflare Workers Free includes 100,000 Worker requests per day. D1 Free includes 5,000,000 rows read per day, 100,000 rows written per day, and 5 GB total storage. Durable Objects Free includes 100,000 DO requests per day and 13,000 GB-s duration per day.

Under the default six-participant room shape:

- D1 writes are the first practical D1 limit: about 100,000 / 23 = roughly 4,300 completed full rooms per day, before index-write overhead and rename traffic.
- Worker request headroom depends on page/API usage. A simple create + lookup + six socket upgrades is single-digit dynamic Worker requests per room, so the 100,000/day Worker request limit is likely higher than the D1 write ceiling for normal use.
- Durable Object request headroom depends on signaling chatter. If each participant sends about 10 signaling messages during connection setup, a full six-person room is roughly 60 signaling messages plus 6 socket connections, so 100,000/day DO requests supports about 1,500 full rooms per day. Lower reconnect rates raise this; failed or restrictive-network sessions lower it.
- Storage should stay small because cleanup removes expired rooms and event rows after 24 hours of post-expiry retention.

For planning, a conservative free-tier target is hundreds of full rooms per day. Low thousands per day may fit if signaling remains modest and TURN usage is controlled. Production reliability usually needs a TURN provider, and TURN bandwidth is outside Cloudflare D1/Workers free-tier math.
