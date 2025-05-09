document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const startBtn = document.getElementById('start');
    const stopBtn = document.getElementById('stop');
    const resetBtn = document.getElementById('reset');
    const clearDbBtn = document.getElementById('clearDb');
    const statusEl = document.getElementById('status');
    const progressBar = document.getElementById('progress-value');
    const resultsBody = document.getElementById('results-body');
    const searchInput = document.getElementById('search');
    const statusFilter = document.getElementById('status-filter');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportJsonBtn = document.getElementById('export-json');
    const exportExcelBtn = document.getElementById('export-excel');
    const paginationEl = document.getElementById('pagination');
    const networkGraph = document.getElementById('network-graph');
    const successCountEl = document.getElementById('success-count');
    const errorCountEl = document.getElementById('error-count');
    const totalSizeEl = document.getElementById('total-size');
    const loadDbBtn = document.getElementById('load-db');

    loadDbBtn.addEventListener('click', async () => {
        try {
            const results = await fetch('/api/db-results').then(r => r.json());
            crawlResults = results.map((r, i) => ({...r, index: i + 1}));
            handleSearch();           // re‑apply filters / sorting / render
            showToast(`Loaded ${crawlResults.length} rows from database`);
        } catch (err) {
            console.error('DB load error', err);
            showToast('Failed to load data from DB', 'error');
        }
    });

    // App state
    let crawlResults = [];
    let filteredResults = [];
    let sortField = 'index';
    let sortDirection = 'asc';
    let currentPage = 1;
    let resultsPerPage = 10;
    let isPolling = false;
    let pollInterval = null;
    let crawlStartTime = null;
    let isPaused = false;

    initializeTabs();
    loadSettings();
    createNotificationContainer();

    // Add event listeners
    startBtn.addEventListener('click', startCrawl);
    stopBtn.addEventListener('click', stopCrawl);
    resetBtn.addEventListener('click', resetApp);
    clearDbBtn.addEventListener('click', clearDatabase);
    searchInput.addEventListener('input', handleSearch);
    statusFilter.addEventListener('change', handleSearch);
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => handleSort(th.dataset.sort));
    });
    document.getElementById('save-settings').addEventListener('click', saveSettings);
    exportCsvBtn.addEventListener('click', () => exportData('csv'));
    exportJsonBtn.addEventListener('click', () => exportData('json'));
    exportExcelBtn.addEventListener('click', () => exportData('excel'));

    function createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
        `;
        document.body.appendChild(container);
    }

    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            padding: 10px 15px;
            margin-bottom: 10px;
            border-radius: 4px;
            color: white;
            background-color: ${type === 'error' ? '#e74c3c' : '#3498db'};
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease, fadeOut 0.5s 2.5s ease forwards;
            max-width: 300px;
        `;

        document.getElementById('notification-container').appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    function initializeTabs() {
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                tab.classList.add('active');
                document.getElementById(tab.dataset.tab).classList.add('active');

                if (tab.dataset.tab === 'visualization' || tab.dataset.tab === 'stats') {
                    updateVisualizations();
                }
            });
        });
    }

    function loadSettings() {
        const settings = JSON.parse(localStorage.getItem('multicrawler-settings')) || {};
        resultsPerPage = settings.resultsPerPage || 10;
        document.getElementById('results-per-page').value = resultsPerPage;

        const autoRefreshEl = document.getElementById('auto-refresh');
        if (autoRefreshEl) {
            autoRefreshEl.value = settings.autoRefresh || 1;
        }

        const themeEl = document.getElementById('theme');
        if (settings.theme && themeEl) {
            themeEl.value = settings.theme;
        }
    }

    function saveSettings() {
        const settings = {
            resultsPerPage: parseInt(document.getElementById('results-per-page').value),
            autoRefresh: parseInt(document.getElementById('auto-refresh').value)
        };

        const themeEl = document.getElementById('theme');
        if (themeEl) {
            settings.theme = themeEl.value;
        }

        localStorage.setItem('multicrawler-settings', JSON.stringify(settings));
        resultsPerPage = settings.resultsPerPage;

        updatePagination();
        renderResults();

        showToast('Settings saved successfully!');
    }

    async function startCrawl() {
        const seedUrl = document.getElementById('seed').value;
        if (!seedUrl) {
            showToast('Please enter a seed URL', 'error');
            return;
        }

        try {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            stopBtn.innerHTML = '<i class="fas fa-pause"></i> Pause';

            if (!isPaused) {
                crawlResults = [];
                filteredResults = [];
                updateResultsStats();
                renderResults();
                crawlStartTime = Date.now();
            } else {
                startBtn.innerHTML = '<i class="fas fa-play"></i> Start';
            }



            const response = await fetch('/api/start', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    seedUrl: seedUrl,
                    maxDepth: parseInt(document.getElementById('depth').value),
                    threads: parseInt(document.getElementById('threads').value),
                    delay: parseInt(document.getElementById('delay').value),
                    userAgent: document.getElementById('userAgent').value,
                    filter: document.getElementById('filter').value,
                    timeout: parseInt(document.getElementById('timeout').value)
                })
            });

            if (!isPaused) {
                crawlStartTime = Date.now();
            }

            isPolling = true;
            const wasResuming = isPaused;
            isPaused = false;

            clearInterval(pollInterval);
            const autoRefreshSeconds = parseInt(document.getElementById('auto-refresh').value);
            if (autoRefreshSeconds > 0) {
                pollInterval = setInterval(pollStatus, autoRefreshSeconds * 1000);
            }

            await pollStatus();

            if (wasResuming) {
                showToast('Crawl restarted');
            } else {
                showToast('Crawl started');
            }
        } catch (error) {
            console.error('Error starting crawl:', error);
            showToast('Failed to start crawl: ' + error.message, 'error');
            startBtn.disabled = false;
        }
    }

    async function stopCrawl() {
        try {
            if (isPaused) {
                await fetch('/api/terminate', {method: 'POST'});
                stopBtn.disabled = true;
                startBtn.disabled = false;
                stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
                isPaused = false;
                clearInterval(pollInterval);
                isPolling = false;
                showToast('Crawl terminated');
            } else {
                await fetch('/api/stop', {method: 'POST'});
                stopBtn.innerHTML = '<i class="fas fa-times"></i> Terminate';
                startBtn.disabled = false;
                startBtn.innerHTML = '<i class="fas fa-play"></i> Restart';
                isPaused = true;
                clearInterval(pollInterval);
                isPolling = false;
                showToast('Crawl paused');

                setTimeout(() => {
                    pollStatus();
                }, 100);
            }
        } catch (error) {
            console.error('Error stopping crawl:', error);
            showToast('Failed to stop crawl: ' + error.message, 'error');
        }
    }



    function resetApp() {
        fetch('/api/terminate', {method: 'POST'}).catch(err => console.error('Error terminating crawl:', err));

        if (isPolling) {
            clearInterval(pollInterval);
            isPolling = false;
        }

        crawlResults = [];
        filteredResults = [];
        currentPage = 1;
        sortField = 'index';
        sortDirection = 'asc';
        isPaused = false;

        // Reset
        document.getElementById('seed').value = '';
        document.getElementById('depth').value = 2;
        document.getElementById('threads').value = 4;
        document.getElementById('delay').value = 0;
        document.getElementById('timeout').value = 10000;
        document.getElementById('userAgent').value = 'MultiCrawlerBot/1.0';
        document.getElementById('filter').value = '';

        statusEl.textContent = 'Idle';
        progressBar.style.width = '0%';

        startBtn.disabled = false;
        startBtn.innerHTML = '<i class="fas fa-play"></i> Start';
        stopBtn.disabled = true;
        stopBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';

        updateResultsStats();
        renderResults();
        resetVisualizations();
    }



    async function clearDatabase() {
        if (confirm('Are you sure you want to clear all crawl results from the database?')) {
            try {
                await fetch('/api/clear-db', {method: 'POST'});
                alert('Database cleared successfully');
                resetApp();
            } catch (error) {
                console.error('Error clearing database:', error);
                alert('Failed to clear database: ' + error.message);
            }
        }
    }

    function formatTime(ms) {
        const seconds = ms / 1000;
        if (seconds < 60) {
            return `${seconds.toFixed(1)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }

    async function pollStatus() {
        try {
            const statusResponse = await fetch('/api/status');
            const status = await statusResponse.json();

            statusEl.textContent = JSON.stringify(status, null, 2);

            if (status.totalTasks > 0) {
                const progress = (status.completedTasks / status.totalTasks) * 100;
                progressBar.style.width = `${progress}%`;
            }

            if (status.duration) {
                document.getElementById('stats-time').textContent = formatTime(status.duration);
            }

            const resultsResponse = await fetch('/api/results');
            const results = await resultsResponse.json();
            crawlResults = results.map((r, i) => ({...r, index: i + 1}));

            updateResultsStats();
            handleSearch();
            updateVisualizations();

            if (status.paused) {
                startBtn.disabled = false;
                stopBtn.disabled = false;
                stopBtn.innerHTML = '<i class="fas fa-times"></i> Terminate';
                return;
            }

            if (!status.running && !status.paused && isPolling) {
                clearInterval(pollInterval);
                isPolling = false;
                startBtn.disabled = false;
                stopBtn.disabled = true;

                if (status.duration) {
                    document.getElementById('stats-time').textContent = formatTime(status.duration);
                }

                showToast('Crawl complete!');
            }
        } catch (error) {
            console.error('Error polling status:', error);
        }
    }




    function handleSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const statusValue = statusFilter.value;

        filteredResults = crawlResults.filter(r => {
            const matchesSearch = r.url.toLowerCase().includes(searchTerm);

            let matchesStatus = true;
            if (statusValue !== 'all') {
                if (statusValue === '3xx') {
                    matchesStatus = r.statusCode >= 300 && r.statusCode < 400;
                } else if (statusValue === '4xx') {
                    matchesStatus = r.statusCode >= 400 && r.statusCode < 500;
                } else if (statusValue === '5xx') {
                    matchesStatus = r.statusCode >= 500;
                } else {
                    matchesStatus = r.statusCode === parseInt(statusValue);
                }
            }

            return matchesSearch && matchesStatus;
        });

        currentPage = 1;

        sortResults();

        updatePagination();
        renderResults();
    }

    function handleSort(field) {
        if (sortField === field) {
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = field;
            sortDirection = 'asc';
        }

        document.querySelectorAll('th').forEach(th => {
            th.classList.remove('sort-asc', 'sort-desc');
            if (th.dataset.sort === sortField) {
                th.classList.add(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
            }
        });

        sortResults();
        renderResults();
    }

    function sortResults() {
        filteredResults.sort((a, b) => {
            let valueA, valueB;

            if (sortField === 'index' || sortField === 'statusCode' || sortField === 'contentSize') {
                valueA = a[sortField];
                valueB = b[sortField];
            } else if (sortField === 'timestamp') {
                valueA = a[sortField] || 0;
                valueB = b[sortField] || 0;
            } else {
                valueA = String(a[sortField] || '').toLowerCase();
                valueB = String(b[sortField] || '').toLowerCase();
            }

            if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
            if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }

    function updatePagination() {
        const totalPages = Math.ceil(filteredResults.length / resultsPerPage) || 1;

        if (currentPage > totalPages) {
            currentPage = totalPages;
        }

        let paginationHTML = '';

        paginationHTML += `<button ${currentPage === 1 ? 'disabled' : ''} 
                         onclick="document.dispatchEvent(new CustomEvent('page-change', {detail: ${currentPage - 1}}))">&laquo;</button>`;

        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        if (startPage > 1) {
            paginationHTML += `<button onclick="document.dispatchEvent(new CustomEvent('page-change', {detail: 1}))">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<button disabled>...</button>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `<button ${i === currentPage ? 'class="active"' : ''} 
                             onclick="document.dispatchEvent(new CustomEvent('page-change', {detail: ${i}}))">${i}</button>`;
        }

        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<button disabled>...</button>`;
            }
            paginationHTML += `<button onclick="document.dispatchEvent(new CustomEvent('page-change', {detail: ${totalPages}}))">${totalPages}</button>`;
        }

        paginationHTML += `<button ${currentPage === totalPages ? 'disabled' : ''} 
                         onclick="document.dispatchEvent(new CustomEvent('page-change', {detail: ${currentPage + 1}}))">&raquo;</button>`;

        paginationEl.innerHTML = paginationHTML;
    }

    function renderResults() {
        const start = (currentPage - 1) * resultsPerPage;
        const end = start + resultsPerPage;
        const pageResults = filteredResults.slice(start, end);

        resultsBody.innerHTML = '';

        if (pageResults.length === 0) {
            resultsBody.innerHTML = `<tr><td colspan="7" style="text-align:center">No results found</td></tr>`;
            return;
        }

        pageResults.forEach(result => {
            const row = document.createElement('tr');

            const date = result.timestamp ? new Date(result.timestamp) : new Date();
            const formattedTime = date.toLocaleTimeString();

            const formattedSize = formatBytes(result.contentSize);

            let statusClass = '';
            if (result.statusCode >= 200 && result.statusCode < 300) statusClass = 'text-success';
            else if (result.statusCode >= 300 && result.statusCode < 400) statusClass = 'text-warning';
            else if (result.statusCode >= 400) statusClass = 'text-danger';

            row.innerHTML = `
            <td>${result.index}</td>
            <td class="url-cell">
                <div class="tooltip">
                    <a href="${result.url}" target="_blank" rel="noopener noreferrer">${truncateUrl(result.url, 50)}</a>
                    <span class="tooltiptext">${result.url}</span>
                </div>
            </td>
            <td class="${statusClass}">${result.statusCode || 'N/A'}</td>
            <td>${formattedSize}</td>
            <td>${result.contentType || 'Unknown'}</td>
            <td>${formattedTime}</td>
            <td>${result.title || ''}</td>
        `;
            resultsBody.appendChild(row);
        });
    }


    function updateResultsStats() {
        let successCount = 0;
        let errorCount = 0;
        let totalSize = 0;
        let revisitCount = 0;

        crawlResults.forEach(result => {
            if (result.statusCode >= 200 && result.statusCode < 300) {
                successCount++;
            } else if (result.statusCode === 304) {
                revisitCount++;
            } else {
                errorCount++;
            }
            totalSize += result.contentSize || 0;
        });

        successCountEl.textContent = successCount;
        errorCountEl.textContent = errorCount;
        totalSizeEl.textContent = formatBytes(totalSize);

        // Update revisit count if element exists
        const revisitCountEl = document.getElementById('revisit-count');
        if (revisitCountEl) {
            revisitCountEl.textContent = revisitCount;
        }

        document.getElementById('stats-total').textContent = crawlResults.length;
        document.getElementById('stats-avg-size').textContent =
            crawlResults.length ? formatBytes(totalSize / crawlResults.length) : '0 B';
        document.getElementById('stats-success-rate').textContent =
            crawlResults.length ? `${Math.round((successCount / crawlResults.length) * 100)}%` : '0%';

    }


    function updateVisualizations() {
        if (crawlResults.length === 0) return;

        if (document.getElementById('visualization').classList.contains('active')) {
            renderNetworkGraph();
        }

        if (document.getElementById('stats').classList.contains('active')) {
            renderStatusChart();
            renderContentTypeChart();
        }
    }

    function renderNetworkGraph() {
        networkGraph.innerHTML = '';

        const nodes = [];
        const links = [];
        const urlMap = {};

        crawlResults.forEach((result, i) => {
            if (!urlMap[result.url]) {
                const domain = extractDomain(result.url);
                urlMap[result.url] = i;
                nodes.push({
                    id: i,
                    url: result.url,
                    domain: domain,
                    status: result.statusCode || 0
                });
            }

            if (result.referrer && result.referrer !== '') {
                if (!urlMap[result.referrer]) {
                    const domain = extractDomain(result.referrer);
                    urlMap[result.referrer] = nodes.length;
                    nodes.push({
                        id: nodes.length,
                        url: result.referrer,
                        domain: domain,
                        status: 0
                    });
                }

                links.push({
                    source: urlMap[result.referrer],
                    target: urlMap[result.url]
                });
            }
        });

        if (nodes.length === 0) {
            networkGraph.innerHTML = '<p>No data available for visualization</p>';
            return;
        }

        const width = networkGraph.clientWidth;
        const height = networkGraph.clientHeight;
        const svg = d3.select('#network-graph')
            .append('svg')
            .attr('width', width)
            .attr('height', height);

        const color = d3.scaleOrdinal()
            .domain(['success', 'redirect', 'client-error', 'server-error', 'unknown'])
            .range(['#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8']);

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink(links).id(d => d.id))
            .force('charge', d3.forceManyBody().strength(-100))
            .force('center', d3.forceCenter(width / 2, height / 2));

        const link = svg.append('g')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('stroke', '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', 1);

        const node = svg.append('g')
            .selectAll('circle')
            .data(nodes)
            .enter().append('circle')
            .attr('r', 5)
            .attr('fill', d => {
                if (d.status >= 200 && d.status < 300) return color('success');
                if (d.status >= 300 && d.status < 400) return color('redirect');
                if (d.status >= 400 && d.status < 500) return color('client-error');
                if (d.status >= 500) return color('server-error');
                return color('unknown');
            })
            .call(drag(simulation));

        node.append('title')
            .text(d => d.url);

        simulation.on('tick', () => {
            link
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            node
                .attr('cx', d => d.x = Math.max(5, Math.min(width - 5, d.x)))
                .attr('cy', d => d.y = Math.max(5, Math.min(height - 5, d.y)));
        });

        function drag(simulation) {
            function dragstarted(event) {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                event.subject.fx = event.subject.x;
                event.subject.fy = event.subject.y;
            }

            function dragged(event) {
                event.subject.fx = event.x;
                event.subject.fy = event.y;
            }

            function dragended(event) {
                if (!event.active) simulation.alphaTarget(0);
                event.subject.fx = null;
                event.subject.fy = null;
            }

            return d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended);
        }
    }

    function renderStatusChart() {
        const statusCounts = {};
        crawlResults.forEach(result => {
            const status = result.statusCode || 0;
            const category = status >= 500 ? '5xx' :
                status >= 400 ? '4xx' :
                    status >= 300 ? '3xx' :
                        status >= 200 ? '2xx' : 'Unknown';
            statusCounts[category] = (statusCounts[category] || 0) + 1;
        });

        const data = Object.entries(statusCounts).map(([key, value]) => ({category: key, count: value}));

        const container = document.getElementById('status-chart');
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;
        const margin = {top: 20, right: 30, bottom: 40, left: 40};
        const chartWidth = width - margin.left - margin.right;
        const chartHeight = height - margin.top - margin.bottom;

        const svg = d3.select('#status-chart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(data.map(d => d.category))
            .range([0, chartWidth])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.count)])
            .nice()
            .range([chartHeight, 0]);

        const color = d3.scaleOrdinal()
            .domain(['2xx', '3xx', '4xx', '5xx', 'Unknown'])
            .range(['#28a745', '#ffc107', '#dc3545', '#6c757d', '#17a2b8']);

        svg.selectAll('.bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.category))
            .attr('y', d => y(d.count))
            .attr('width', x.bandwidth())
            .attr('height', d => chartHeight - y(d.count))
            .attr('fill', d => color(d.category));

        svg.append('g')
            .attr('transform', `translate(0,${chartHeight})`)
            .call(d3.axisBottom(x));

        svg.append('g')
            .call(d3.axisLeft(y));

        svg.selectAll('.label')
            .data(data)
            .enter().append('text')
            .attr('class', 'label')
            .attr('x', d => x(d.category) + x.bandwidth() / 2)
            .attr('y', d => y(d.count) - 5)
            .attr('text-anchor', 'middle')
            .text(d => d.count);
    }

    function renderContentTypeChart() {
        const contentCounts = {};
        crawlResults.forEach(result => {
            let type = 'Unknown';
            if (result.contentType) {
                type = result.contentType.split(';')[0];
                type = type.split('/')[0] || type;
            }
            contentCounts[type] = (contentCounts[type] || 0) + 1;
        });

        const data = Object.entries(contentCounts).map(([key, value]) => ({type: key, count: value}));

        const container = document.getElementById('content-chart');
        container.innerHTML = '';
        const width = container.clientWidth;
        const height = container.clientHeight;
        const radius = Math.min(width, height) / 2 - 40;

        const svg = d3.select('#content-chart')
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${width / 2},${height / 2})`);

        const color = d3.scaleOrdinal(d3.schemeCategory10);

        const pie = d3.pie()
            .value(d => d.count)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const labelArc = d3.arc()
            .innerRadius(radius * 0.6)
            .outerRadius(radius * 0.6);

        const arcs = svg.selectAll('.arc')
            .data(pie(data))
            .enter().append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.type));

        arcs.append('text')
            .attr('transform', d => `translate(${labelArc.centroid(d)})`)
            .attr('dy', '.35em')
            .attr('text-anchor', 'middle')
            .text(d => `${d.data.type}: ${d.data.count}`);
    }

    function resetVisualizations() {
        document.getElementById('network-graph').innerHTML = '';
        document.getElementById('status-chart').innerHTML = '';
        document.getElementById('content-chart').innerHTML = '';
    }

    function exportData(format) {
        if (crawlResults.length === 0) {
            alert('No data to export');
            return;
        }

        let data, filename, mime;

        switch (format) {
            case 'csv':
                data = convertToCsv(crawlResults);
                filename = 'crawl-results.csv';
                mime = 'text/csv';
                break;
            case 'json':
                data = JSON.stringify(crawlResults, null, 2);
                filename = 'crawl-results.json';
                mime = 'application/json';
                break;
            case 'excel':
                data = convertToCsv(crawlResults);
                filename = 'crawl-results.xls';
                mime = 'application/vnd.ms-excel';
                break;
        }

        const blob = new Blob([data], {type: mime});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function convertToCsv(data) {
        if (data.length === 0) return '';

        const headers = Object.keys(data[0]).filter(k => k !== 'index');

        let csv = headers.join(',') + '\n';

        data.forEach(item => {
            const row = headers.map(header => {
                let value = item[header] || '';
                // Escape quotes and wrap in quotes if contains comma
                if (typeof value === 'string' && (value.includes('"') || value.includes(','))) {
                    value = `"${value.replace(/"/g, '""')}"`;
                }
                return value;
            });
            csv += row.join(',') + '\n';
        });

        return csv;
    }

    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
    }

    function truncateUrl(url, maxLength) {
        if (url.length <= maxLength) return url;
        return url.substring(0, maxLength - 3) + '...';
    }

    function extractDomain(url) {
        try {
            return new URL(url).hostname;
        } catch (e) {
            return url;
        }
    }

    document.addEventListener('page-change', (e) => {
        currentPage = e.detail;
        updatePagination();
        renderResults();
    });
});