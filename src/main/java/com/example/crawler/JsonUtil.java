package com.example.crawler;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import java.util.List;

// Utility class for JSON serialization and deserialization
public class JsonUtil {
    private static final Gson gson = new GsonBuilder().setPrettyPrinting().create();

    public static String toJson(Object obj) {
        return gson.toJson(obj);
    }

    public static <T> T fromJson(String json, Class<T> classOfT) {
        return gson.fromJson(json, classOfT);
    }

    public static CrawlRequest parseCrawlRequest(String json) {
        return fromJson(json, CrawlRequest.class);
    }

    public static String crawlResultsToJson(List<CrawlResult> results) {
        return toJson(results);
    }

    public static String statusToJson(Status status) {
        return toJson(status);
    }
}