package com.example.crawler;

public record CrawlResult(
        String url,
        int statusCode,
        long contentSize,
        String referrer,
        String contentType,
        String title,
        long loadTime,
        long timestamp
) {
    public CrawlResult(String url, int statusCode, long contentSize, String referrer, long timestamp) {
        this(url, statusCode, contentSize, referrer, null, null, 0, timestamp);
    }
}