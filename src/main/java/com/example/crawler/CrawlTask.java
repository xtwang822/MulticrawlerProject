package com.example.crawler;

import org.jsoup.Connection;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.select.Elements;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

public class CrawlTask implements Runnable {
    private static final Map<String, VisitInfo> VISITED_INFO = new ConcurrentHashMap<>();
    private final String url;
    private final int depth;
    private final int maxDepth;
    private final CrawlerService service;
    private final DatabaseManager db;
    private final String referrer;
    private final Pattern urlFilter;
    private final int delay;
    private final String userAgent;
    private final int timeout;

    static class VisitInfo {
        int count;
        long lastVisitTimestamp;

        VisitInfo(int count, long timestamp) {
            this.count = count;
            this.lastVisitTimestamp = timestamp;
        }
    }

    public CrawlTask(
            String url,
            int depth,
            int maxDepth,
            CrawlerService service,
            DatabaseManager db,
            String referrer,
            String urlFilterPattern,
            int delay,
            String userAgent,
            int timeout
    ) {
        this.url = url;
        this.depth = depth;
        this.maxDepth = maxDepth;
        this.service = service;
        this.db = db;
        this.referrer = referrer;
        this.urlFilter = urlFilterPattern != null && !urlFilterPattern.isEmpty()
                ? Pattern.compile(urlFilterPattern)
                : null;
        this.delay = delay;
        this.userAgent = userAgent;
        this.timeout = timeout;
    }

    public CrawlTask(String url, int depth, int maxDepth, CrawlerService service, DatabaseManager db) {
        this(url, depth, maxDepth, service, db, "", null, 0, "MultiCrawlerBot/1.0", 10000);
    }

    @Override
    public void run() {
        if (delay > 0) {
            try {
                Thread.sleep(delay);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }

        long currentTime = Instant.now().toEpochMilli();
        VisitInfo visitInfo = VISITED_INFO.compute(url, (k, v) -> {
            if (v == null) {
                return new VisitInfo(1, currentTime);
            } else {
                v.count++;
                v.lastVisitTimestamp = currentTime;
                return v;
            }
        });

        boolean isRevisit = visitInfo.count > 1;

        if (isRevisit && service.isActiveSession()) {
            CrawlResult revisitResult = new CrawlResult(
                    url,
                    304, // appropriate status for revisits
                    0,
                    referrer,
                    "text/html",
                    "REVISIT: Previously crawled " + formatTimeDifference(currentTime - visitInfo.lastVisitTimestamp) + " ago",
                    0,
                    currentTime
            );
            service.addResult(revisitResult);
            service.taskCompleted();
            return;
        }

        try {
            long startTime = System.currentTimeMillis();
            Connection connection = Jsoup.connect(url)
                    .ignoreContentType(true)
                    .userAgent(userAgent)
                    .timeout(timeout)
                    .followRedirects(true)
                    .maxBodySize(10_000_000); // 10MB max

            Connection.Response resp = connection.execute();
            int status = resp.statusCode();
            byte[] body = resp.bodyAsBytes();
            long loadTime = System.currentTimeMillis() - startTime;
            String contentType = resp.contentType();
            String title = null;

            if (contentType != null && contentType.startsWith("text/html")) {
                Document doc = resp.parse();
                title = doc.title();

                if (isRevisit) {
                    title = "[REVISITED] " + title;
                }

                if (depth < maxDepth) {
                    Elements links = doc.select("a[href]");
                    links.stream()
                            .map(l -> l.attr("abs:href"))
                            .filter(this::isValidUrl)
                            .forEach(link -> {
                                CrawlTask newTask = new CrawlTask(
                                        link,
                                        depth + 1,
                                        maxDepth,
                                        service,
                                        db,
                                        url,
                                        urlFilter != null ? urlFilter.pattern() : null,
                                        delay,
                                        userAgent,
                                        timeout
                                );
                                service.enqueueTask(newTask);
                            });
                }
            }

            CrawlResult result = new CrawlResult(
                    url,
                    status,
                    body.length,
                    referrer,
                    contentType,
                    title,
                    loadTime,
                    Instant.now().toEpochMilli()
            );
            service.addResult(result);

        } catch (Exception e) {
            CrawlResult errorResult = new CrawlResult(
                    url,
                    500,
                    0,
                    referrer,
                    null,
                    isRevisit ? "[REVISITED] Error processing URL" : "Error processing URL",
                    0,
                    Instant.now().toEpochMilli()
            );
            service.addResult(errorResult);
        } finally {
            service.taskCompleted();
        }
    }

    private boolean isValidUrl(String u) {
        try {
            URI uri = new URI(u);
            String scheme = uri.getScheme();
            boolean isHttp = scheme != null && (scheme.equals("http") || scheme.equals("https"));

            if (urlFilter != null && !urlFilter.matcher(u).matches()) {
                return false;
            }

            return isHttp;
        } catch (URISyntaxException e) {
            return false;
        }
    }

    private String formatTimeDifference(long timeDiff) {
        long seconds = timeDiff / 1000;
        if (seconds < 60) {
            return seconds + " seconds";
        } else if (seconds < 3600) {
            return (seconds / 60) + " minutes";
        } else {
            return (seconds / 3600) + " hours";
        }
    }

    public static void resetVisitedInfo() {
        VISITED_INFO.clear();
    }
}

