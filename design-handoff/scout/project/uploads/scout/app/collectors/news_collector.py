import feedparser

def collect_rss(feed_urls: list[str], limit: int = 20) -> list[dict]:
    items = []
    for url in feed_urls:
        feed = feedparser.parse(url)
        for entry in feed.entries[:limit]:
            items.append({"title": entry.get("title"), "link": entry.get("link"), "published": entry.get("published"), "source": url})
    return items[:limit]
