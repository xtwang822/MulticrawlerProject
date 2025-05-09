package com.example.crawler;

import java.time.Instant;
import java.util.List;
import java.util.Queue;
import java.util.concurrent.*;

public class CrawlerService {
    public boolean isActiveSession() {
        return running || paused;
    }
    private ExecutorService executor;
    private final ConcurrentLinkedQueue<CrawlResult> results = new ConcurrentLinkedQueue<>();
    private final Queue<CrawlTask> pendingTasks = new ConcurrentLinkedQueue<>();
    private final DatabaseManager db = new DatabaseManager();
    private volatile boolean running = false;
    private volatile boolean paused = false;
    private int totalTasks = 0;
    private int completedTasks = 0;
    private long startTime = 0;
    private CrawlRequest lastRequest = null;
    private boolean resumingCrawl = false;

    public synchronized void start(CrawlRequest req) {
        if (running) return;

        if (paused && lastRequest != null) {
            resumeCrawl();
            return;
        }

        results.clear();
        pendingTasks.clear();
        executor = Executors.newFixedThreadPool(req.threads());
        running = true;
        paused = false;
        resumingCrawl = false;
        totalTasks = 1;
        completedTasks = 0;
        startTime = Instant.now().toEpochMilli();
        lastRequest = req;

        CrawlTask.resetVisitedInfo();

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

    private synchronized void resumeCrawl() {
        if (!paused || lastRequest == null) return;

        resumingCrawl = true;

        executor = Executors.newFixedThreadPool(lastRequest.threads());
        running = true;
        paused = false;

        int pendingCount = pendingTasks.size();
        if (pendingCount > 0) {
            CrawlTask[] tasks = pendingTasks.toArray(new CrawlTask[0]);
            pendingTasks.clear();

            for (CrawlTask task : tasks) {
                executor.submit(task);
            }

            System.out.println("Resumed crawl with " + pendingCount + " pending tasks");
        } else {
            System.out.println("Warning: Resumed crawl but no pending tasks found");
            if (completedTasks < totalTasks) {
                System.out.println("Creating a new seed task to continue crawling");
                CrawlTask newSeedTask = new CrawlTask(
                        lastRequest.seedUrl(),
                        0, // restart from depth 0
                        lastRequest.maxDepth(),
                        this,
                        db,
                        "",
                        lastRequest.filter(),
                        lastRequest.delay(),
                        lastRequest.userAgent(),
                        lastRequest.timeout()
                );
                executor.submit(newSeedTask);
            }
        }
    }

    public void taskCompleted() {
        completedTasks++;
        if (completedTasks >= totalTasks && running && !resumingCrawl) {
            stop();
        } else if (resumingCrawl && pendingTasks.isEmpty() && completedTasks >= totalTasks) {
            resumingCrawl = false;
        }
    }

    public synchronized void enqueueTask(CrawlTask task) {
        totalTasks++;

        if (running) {
            executor.submit(task);
        } else if (paused) {
            pendingTasks.add(task);
        }
    }

    public Status getStatus() {
        long duration = 0;
        if (startTime > 0) {
            duration = Instant.now().toEpochMilli() - startTime;
        }
        return new Status(running, paused, totalTasks, completedTasks, duration);
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
        paused = true;
        resumingCrawl = false;

        if (executor != null) {
            executor.shutdown();

            Runnable task;
            while (executor instanceof ThreadPoolExecutor &&
                    (task = ((ThreadPoolExecutor) executor).getQueue().poll()) != null) {
                if (task instanceof CrawlTask) {
                    pendingTasks.add((CrawlTask) task);
                }
            }
        }
    }

    public synchronized void terminateCrawl() {
        running = false;
        paused = false;
        resumingCrawl = false;
        if (executor != null) {
            executor.shutdownNow();
        }
        pendingTasks.clear();
        lastRequest = null;
    }

    public boolean clearDatabase() {
        return db.clearAllResults();
    }

    public List<CrawlResult> getResultsFromDb() {
        return db.getAllResults();
    }
}

