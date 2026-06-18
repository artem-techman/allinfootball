import { describe, it, expect } from "vitest";
import { parseFeed } from "@/lib/news/rss";
import { aggregate, tagItem, isTransfer } from "@/lib/news/tagging";

const BBC_ITEM = `
<item>
  <title><![CDATA[Arsenal beat Chelsea in London derby]]></title>
  <description><![CDATA[Arsenal secured a 2-0 win over Chelsea & rivals react.]]></description>
  <link>https://www.bbc.com/sport/football/articles/abc?at_medium=RSS&amp;at_campaign=rss</link>
  <pubDate>Wed, 17 Jun 2026 23:15:39 GMT</pubDate>
  <media:thumbnail width="240" height="134" url="https://ichef.bbci.co.uk/x.jpg"/>
</item>`;

const GUARDIAN_ITEM = `
<item>
  <title>Liverpool sign new midfielder in &#163;40m deal</title>
  <link>https://www.theguardian.com/football/2026/jun/17/liverpool-transfer</link>
  <description>&lt;p&gt;Liverpool have agreed a deal worth &#163;40m for the midfielder.&lt;/p&gt;</description>
  <dc:date>2026-06-17T20:00:00Z</dc:date>
  <media:content width="620" url="https://i.guim.co.uk/y.jpg"/>
</item>`;

const SKY_ITEM = `
<item>
  <title>Man City held by Inter in Champions League opener</title>
  <link>https://www.skysports.com/football/news/123</link>
  <description>Match report and reaction.</description>
  <pubDate>Tue, 16 Jun 2026 18:00:00 GMT</pubDate>
  <enclosure url="https://e0.365dm.com/z.jpg" type="image/jpeg" length="0"/>
</item>`;

const IRRELEVANT = `
<item>
  <title>Local Sunday league weekend roundup</title>
  <link>https://example.com/sunday</link>
  <pubDate>Tue, 16 Jun 2026 10:00:00 GMT</pubDate>
</item>`;

describe("parseFeed", () => {
  it("parses a BBC item: CDATA, entity decode, media:thumbnail", () => {
    const [a] = parseFeed(`<rss>${BBC_ITEM}</rss>`, "BBC Sport");
    expect(a.title).toBe("Arsenal beat Chelsea in London derby");
    expect(a.dek).toBe("Arsenal secured a 2-0 win over Chelsea & rivals react.");
    expect(a.link).toContain("bbc.com");
    expect(a.image).toBe("https://ichef.bbci.co.uk/x.jpg");
    expect(a.sourceName).toBe("BBC Sport");
    expect(a.publishedAtUtc).toBe(new Date("Wed, 17 Jun 2026 23:15:39 GMT").toISOString());
  });

  it("parses a Guardian item: strips HTML, decodes entities, media:content + dc:date", () => {
    const [a] = parseFeed(`<rss>${GUARDIAN_ITEM}</rss>`, "The Guardian");
    expect(a.title).toBe("Liverpool sign new midfielder in £40m deal");
    expect(a.dek).toBe("Liverpool have agreed a deal worth £40m for the midfielder.");
    expect(a.image).toBe("https://i.guim.co.uk/y.jpg");
    expect(a.publishedAtUtc).toBe("2026-06-17T20:00:00.000Z");
  });

  it("parses a Sky item: enclosure image", () => {
    const [a] = parseFeed(`<rss>${SKY_ITEM}</rss>`, "Sky Sports");
    expect(a.image).toBe("https://e0.365dm.com/z.jpg");
  });

  it("never captures a body and drops items without title/link", () => {
    const items = parseFeed(`<rss><item><description>no title</description></item></rss>`, "X");
    expect(items).toHaveLength(0);
  });
});

describe("tagging", () => {
  it("tags competitions and clubs", () => {
    const [raw] = parseFeed(`<rss>${SKY_ITEM}</rss>`, "Sky Sports");
    const a = tagItem(raw);
    expect(a.competitionTags).toContain("premier-league"); // Man City
    expect(a.competitionTags).toContain("serie-a"); // Inter
    expect(a.competitionTags).toContain("champions-league");
    expect(a.body).toBe("");
  });

  it("detects transfer items", () => {
    const [raw] = parseFeed(`<rss>${GUARDIAN_ITEM}</rss>`, "The Guardian");
    expect(isTransfer(raw)).toBe(true);
  });

  it("dedupes by normalised title and filters out irrelevant items", () => {
    const raws = parseFeed(
      `<rss>${BBC_ITEM}${GUARDIAN_ITEM}${SKY_ITEM}${IRRELEVANT}${BBC_ITEM}</rss>`,
      "Mixed",
    );
    const out = aggregate(raws);
    // BBC duplicate collapsed, irrelevant Sunday-league item removed → 3 unique.
    expect(out).toHaveLength(3);
    expect(out.every((a) => a.competitionTags.length > 0)).toBe(true);
    // newest first
    expect(out[0].publishedAtUtc >= out[1].publishedAtUtc).toBe(true);
  });
});
