package com.example.crawler;

import java.sql.*;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Level;
import java.util.logging.Logger;


// Manages database operations for storing and retrieving crawl results
public class DatabaseManager {
    private static final Logger LOGGER = Logger.getLogger(DatabaseManager.class.getName());
    private static final String DB_URL = "jdbc:sqlite:crawl_results.db";

    public DatabaseManager() {
        initializeDatabase();
    }

    private void initializeDatabase() {
        String createTableSQL =
                "CREATE TABLE IF NOT EXISTS crawl_results (" +
                        "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                        "url TEXT NOT NULL," +
                        "status_code INTEGER," +
                        "content_size INTEGER," +
                        "referrer TEXT," +
                        "content_type TEXT," +
                        "page_title TEXT," +
                        "load_time INTEGER," +
                        "timestamp INTEGER" +
                        ")";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {
            stmt.execute(createTableSQL);
            LOGGER.info("Database initialized successfully");
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Failed to initialize database", e);
        }
    }

    private Connection getConnection() throws SQLException {
        return DriverManager.getConnection(DB_URL);
    }

    public void insertResult(CrawlResult result) {
        String sql = "INSERT INTO crawl_results (url, status_code, content_size, referrer, " +
                "content_type, page_title, load_time, timestamp) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";

        try (Connection conn = getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, result.url());
            pstmt.setInt(2, result.statusCode());
            pstmt.setLong(3, result.contentSize());
            pstmt.setString(4, result.referrer());
            pstmt.setString(5, result.contentType());
            pstmt.setString(6, result.title());
            pstmt.setLong(7, result.loadTime());
            pstmt.setLong(8, result.timestamp());

            pstmt.executeUpdate();
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to insert crawl result", e);
        }
    }

    public List<CrawlResult> getAllResults() {
        List<CrawlResult> results = new ArrayList<>();
        String sql = "SELECT url, status_code, content_size, referrer, content_type, " +
                "page_title, load_time, timestamp FROM crawl_results";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            while (rs.next()) {
                CrawlResult result = new CrawlResult(
                        rs.getString("url"),
                        rs.getInt("status_code"),
                        rs.getLong("content_size"),
                        rs.getString("referrer"),
                        rs.getString("content_type"),
                        rs.getString("page_title"),
                        rs.getLong("load_time"),
                        rs.getLong("timestamp")
                );
                results.add(result);
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to retrieve crawl results", e);
        }

        return results;
    }

    public boolean clearAllResults() {
        String sql = "DELETE FROM crawl_results";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement()) {

            stmt.execute(sql);
            return true;
        } catch (SQLException e) {
            LOGGER.log(Level.SEVERE, "Failed to clear crawl results", e);
            return false;
        }
    }

    public CrawlStatistics getStatistics() {
        String sql = "SELECT " +
                "COUNT(*) as total_pages, " +
                "SUM(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 ELSE 0 END) as success_count, " +
                "AVG(content_size) as avg_size, " +
                "MAX(timestamp) - MIN(timestamp) as total_time " +
                "FROM crawl_results";

        try (Connection conn = getConnection();
             Statement stmt = conn.createStatement();
             ResultSet rs = stmt.executeQuery(sql)) {

            if (rs.next()) {
                return new CrawlStatistics(
                        rs.getInt("total_pages"),
                        rs.getInt("success_count"),
                        rs.getDouble("avg_size"),
                        rs.getLong("total_time")
                );
            }
        } catch (SQLException e) {
            LOGGER.log(Level.WARNING, "Failed to retrieve crawl statistics", e);
        }

        return new CrawlStatistics(0, 0, 0, 0);
    }

    public record CrawlStatistics(
            int totalPages,
            int successCount,
            double averageSize,
            long totalTime
    ) {}
}