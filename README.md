# MultiCrawler – Advanced Multithreaded Web Crawler

A full‑stack Java application that crawls the web concurrently, stores rich metadata in SQLite, and offers an interactive browser‑based dashboard with live progress, visual analytics, and export tools.

---

## Table of Contents

1. [Key Features](#key-features)
2. [Architecture](#architecture)
3. [Tech Stack](#tech-stack)
4. [Getting Started](#getting-started)
5. [Running the Application](#running-the-application)
6. [REST API](#rest-api)
7. [Database Schema](#database-schema)
8. [Configuration](#configuration)

---

## Key Features

| Category                | Highlights                                                                                          |
|-------------------------|-----------------------------------------------------------------------------------------------------|
| **Concurrent Crawling** | • `ExecutorService` thread‑pool<br> • Adjustable thread count & politeness delay                    |
| **Data Persistence**    | • SQLite via JDBC<br>• Automatic schema migration<br>• Historical result reload                     |
| **Intuitive GUI**       | • Single‑page app served by Spark static files<br>• Live logs & status<br>• D3.js visualisations    |
| **Analytics & Export**  | • Success/error metrics, size stats<br>• Network graph, bar & pie charts<br>• CSV/JSON/Excel export |

---

## Architecture

* **Frontend**: Static HTML/CSS/JS (served from `src/main/resources/public`) provides the dashboard.
* **Backend**:  Spark Java exposes REST endpoints, orchestrates a multithreaded crawler, and persists results.
* **Database**: Lightweight embedded SQLite file (`crawl_results.db`) stores metadata.

---

## Tech Stack

* **Frontend**:  **HTML 5 / CSS 3 / Vanilla JS** with **FontAwesome** & **D3.js v7** for visualisation
* **Backend**:  **Java 17** /  **Maven** /  **Spark Java**  /  **Jsoup**
* **Database**: **SQLite(JDBC)**

---

## Getting Started

### Prerequisites

* JDK 17+
* Maven 3.9+
* `sqlite3` CLI for inspecting the database

### Clone & Build

```bash
git clone https://github.com/xtwang822/MulticrawlerProject.git # Or you can just open the project directory
cd multicrawler
mvn clean package
```

The default build uses the **exec‑maven‑plugin** (configured in `pom.xml`) so you can also run directly:

```bash
mvn exec:java -Dexec.mainClass="com.example.crawler.Main"
```

---

## Running the Application

### 1. Start the Server

```bash
java -jar target/multicrawler-1.0-SNAPSHOT.jar # Or just run Main.java in MulticrawlerProject\src\main\java\com\example\crawler\Main.java
```

By default the server listens on **[http://localhost:4567](http://localhost:4567)**. Set the `PORT` env var to override.

### 2. Open the Dashboard

Navigate to **[http://localhost:4567](http://localhost:4567)** in your browser and:

1. Enter a *Seed URL* (e.g. `https://example.com`).
2. Adjust depth, thread count, delay, user‑agent, etc.
3. Click **Start**.
4. Observe live progress, explore results, switch to visualisations, or export data.

**Tip:** You can pause with **Stop**, terminate with **Terminate**, restart with **Restart**, or reset/clear DB at any time.

---

## REST API

| Method | Endpoint          | Description                                | Body / Query        |
| ------ | ----------------- |--------------------------------------------|---------------------|
| POST   | `/api/start`      | Start or restart a crawl                   | `CrawlRequest` JSON |
| POST   | `/api/stop`       | Pause the current crawl                    | –                   |
| POST   | `/api/terminate`  | Abort crawl and discard pending tasks      | –                   |
| GET    | `/api/status`     | Current `Status` (running, progress, time) | –                   |
| GET    | `/api/results`    | Results of this session                    | –                   |
| GET    | `/api/db-results` | All historical results in SQLite           | –                   |
| POST   | `/api/clear-db`   | Delete **all** rows in `crawl_results`     | –                   |

Request/response schemas are defined in `JsonUtil.java` and fully typed with Gson.

---

## Database Schema

```sql
CREATE TABLE crawl_results (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  url          TEXT    NOT NULL,
  status_code  INTEGER,
  content_size INTEGER,
  referrer     TEXT,
  content_type TEXT,
  page_title   TEXT,
  load_time    INTEGER,
  timestamp    INTEGER
);
```

The database file is created automatically in the working directory on first launch.

---

## Configuration

| Field           | GUI Input    | CLI/JSON key | Description                       |
|-----------------|--------------| ------------ | --------------------------------- |
| **Seed URL**    | *Seed URL*   | `seedUrl`    | Starting page for the crawl       |
| **Max Depth**   | *Max Depth*  | `maxDepth`   | How many link levels to traverse  |
| **Threads**     | *Threads*    | `threads`    | Size of the crawler thread‑pool   |
| **Delay(ms)**   | *Delay*      | `delay`      | Politeness delay between requests |
| **User Agent**  | *User Agent* | `userAgent`  | Sent in request headers           |
| **URL Filter**  | *URL Filter* | `filter`     | Regex to include/exclude URLs     |
| **Timeout(ms)** | *Timeout*    | `timeout`    | Connection/read timeout           |

These can be preset in the GUI or passed in the `/api/start` JSON body.
