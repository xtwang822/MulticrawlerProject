package com.example.crawler;

public record CrawlRequest(
        String seedUrl,
        int maxDepth,
        int threads,
        int delay,           // Delay between requests in milliseconds
        String userAgent,    // Custom user agent
        String filter,       // URL regex filter
        int timeout          // Connection timeout in milliseconds
) {
    public CrawlRequest {
        if (userAgent == null || userAgent.isBlank()) {
            userAgent = "MultiCrawlerBot/1.0";
        }
        if (timeout <= 0) {
            timeout = 10000;
        }
    }
}