package com.example.crawler;

// Represents the current status of a crawl operation
public record Status(
        boolean running,
        int totalTasks,
        int completedTasks,
        long duration
) {
    public int getProgressPercentage() {
        if (totalTasks == 0) return 0;
        return (int) ((completedTasks * 100.0) / totalTasks);
    }

    public boolean isComplete() {
        return !running && completedTasks >= totalTasks;
    }

    public String getFormattedDuration() {
        long seconds = duration / 1000;
        if (seconds < 60) {
            return seconds + " seconds";
        } else if (seconds < 3600) {
            return (seconds / 60) + " minutes " + (seconds % 60) + " seconds";
        } else {
            long hours = seconds / 3600;
            long minutes = (seconds % 3600) / 60;
            return hours + " hours " + minutes + " minutes";
        }
    }
}