package com.example.crawler;

import static spark.Spark.*;
import java.util.List;


public class Main {
    private static final CrawlerService crawlerService = new CrawlerService();

    public static void main(String[] args) {
        // default: 4567
        port(getPort());

        staticFiles.location("/public");

        enableCORS();

        setupRoutes();

        System.out.println("MultiCrawler server started on port " + getPort());
        System.out.println("Open your browser and navigate to http://localhost:" + getPort());
    }

    private static void setupRoutes() {
        post("/api/start", (req, res) -> {
            try {
                CrawlRequest crawlRequest = JsonUtil.parseCrawlRequest(req.body());
                crawlerService.start(crawlRequest);
                res.status(200);
                return "{\"status\":\"started\"}";
            } catch (Exception e) {
                res.status(400);
                return "{\"error\":\"" + e.getMessage() + "\"}";
            }
        });

        post("/api/stop", (req, res) -> {
            crawlerService.stop();
            res.status(200);
            return "{\"status\":\"stopped\"}";
        });

        get("/api/status", (req, res) -> {
            res.type("application/json");
            return JsonUtil.statusToJson(crawlerService.getStatus());
        });

        get("/api/results", (req, res) -> {
            res.type("application/json");
            List<CrawlResult> results = crawlerService.getResults();
            return JsonUtil.crawlResultsToJson(results);
        });

        post("/api/clear-db", (req, res) -> {
            boolean success = crawlerService.clearDatabase();
            res.status(success ? 200 : 500);
            return "{\"success\":" + success + "}";
        });

        notFound((req, res) -> {
            res.type("application/json");
            return "{\"error\":\"Not found\"}";
        });

        exception(Exception.class, (e, req, res) -> {
            res.status(500);
            res.type("application/json");
            res.body("{\"error\":\"" + e.getMessage() + "\"}");
        });

        get("/api/db-results", (req, res) -> {
            res.type("application/json");
            return JsonUtil.crawlResultsToJson(crawlerService.getResultsFromDb());
        });
    }

    private static void enableCORS() {
        options("/*", (request, response) -> {
            String accessControlRequestHeaders = request.headers("Access-Control-Request-Headers");
            if (accessControlRequestHeaders != null) {
                response.header("Access-Control-Allow-Headers", accessControlRequestHeaders);
            }

            String accessControlRequestMethod = request.headers("Access-Control-Request-Method");
            if (accessControlRequestMethod != null) {
                response.header("Access-Control-Allow-Methods", accessControlRequestMethod);
            }

            return "OK";
        });

        before((request, response) -> {
            response.header("Access-Control-Allow-Origin", "*");
            response.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
            response.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Content-Length, Accept, Origin");
            response.type("application/json");
        });
    }

    private static int getPort() {
        String port = System.getenv("PORT");
        if (port != null) {
            try {
                return Integer.parseInt(port);
            } catch (NumberFormatException e) {
                // Fall back to default port
            }
        }
        return 4567;
    }
}