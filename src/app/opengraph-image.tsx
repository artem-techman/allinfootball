import { ImageResponse } from "next/og";

export const alt = "My Football Tracker — Live scores, tables & match stats";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PIN = `<svg width="240" height="240" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#23A455"/><stop offset="50%" stop-color="#5BC850"/><stop offset="100%" stop-color="#D9FF3F"/></linearGradient></defs><path d="M50 7C29.7 7 13 23.7 13 44C13 67 41 84 50 95C59 84 87 67 87 44C87 23.7 70.3 7 50 7Z" fill="url(#g)"/><g fill="none" stroke="#fff" stroke-width="5"><circle cx="50" cy="43" r="23"/><line x1="50" y1="20" x2="50" y2="66" stroke-linecap="round"/></g><circle cx="50" cy="43" r="7.5" fill="url(#g)" stroke="#fff" stroke-width="4.5"/></svg>`;

/** Social / search share image (og:image + twitter:image fallback). */
export default function OpengraphImage() {
  const pinUrl = `data:image/svg+xml;base64,${Buffer.from(PIN).toString("base64")}`;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "radial-gradient(900px 600px at 78% 30%, #14361f 0%, #08090c 60%)",
          color: "#ffffff",
          padding: "0 90px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pinUrl} width={150} height={150} alt="" />
          <div style={{ fontSize: 70, fontWeight: 800, letterSpacing: -1 }}>My Football Tracker</div>
        </div>
        <div style={{ marginTop: 28, fontSize: 40, color: "#cbd2da" }}>
          Live scores · tables · fixtures · lineups · stats
        </div>
        <div style={{ marginTop: 16, fontSize: 27, color: "#8b929c" }}>
          Premier League · La Liga · Serie A · Bundesliga · Ligue 1 · UCL · Europa · MLS · World Cup
        </div>
      </div>
    ),
    size,
  );
}
