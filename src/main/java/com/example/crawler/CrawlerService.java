package com.example.crawler;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.*;

public class CrawlerService {
    private ExecutorService executor;
    private final ConcurrentLinkedQueue<CrawlResult> results = new ConcurrentLinkedQueue<>();
    private final DatabaseManager db = new DatabaseManager();
    private volatile boolean running = false;
    private int totalTasks = 0;
    private int completedTasks = 0;
    private long startTime = 0;

    public synchronized void start(CrawlRequest req) {
        if (running) return;
        results.clear();
        executor = Executors.newFixedThreadPool(req.threads());
        running = true;
        totalTasks = 1;
        completedTasks = 0;
        startTime = Instant.now().toEpochMilli();

        CrawlTask initialTask = new CrawlTask(
                req.seedUrl(),
                0,
                req.maxDepth(),
                this,
                db,
                "",
                req.filter(),
                req.delay(),
                req.userAgent(),
                req.timeout()
        );

        executor.submit(initialTask);
    }

    public void taskCompleted() {
        completedTasks++;
        if (completedTasks >= totalTasks) stop();
    }

    public synchronized void enqueueTask(CrawlTask task) {
        if (running) {
            totalTasks++;
            executor.submit(task);
        }
    }

    public Status getStatus() {
        long duration = 0;
        if (startTime > 0) {
            duration = Instant.now().toEpochMilli() - startTime;
        }
        return new Status(running, totalTasks, completedTasks, duration);
    }

    public List<CrawlResult> getResults() {
        return results.stream().toList();
    }

    public void addResult(CrawlResult r) {
        results.add(r);
        db.insertResult(r);
    }

    public synchronized void stop() {
        if (!running) return;
        running = false;
        if (executor != null) {
            executor.shutdownNow();
        }
    }

    public boolean clearDatabase() {
        return db.clearAllResults();
    }

    public List<CrawlResult> getResultsFromDb() {
        return db.getAllResults();
    }

}