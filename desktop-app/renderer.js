// Renderer process script
const { electronAPI } = window;

let startTime = null;
let uptimeInterval = null;
let stats = {
    scans: 0,
    opportunities: 0,
    trades: 0,
};

// DOM elements
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const output = document.getElementById('output');
const clearBtn = document.getElementById('clear-btn');
const contractAddress = document.getElementById('contract-address');
const rpcUrl = document.getElementById('rpc-url');
const uptimeEl = document.getElementById('uptime');
const scanCountEl = document.getElementById('scan-count');
const opportunitiesCountEl = document.getElementById('opportunities-count');
const tradesCountEl = document.getElementById('trades-count');

// Initialize
async function init() {
    // Load contract info
    const info = await electronAPI.getContractInfo();
    contractAddress.textContent = info.contractAddress;
    rpcUrl.textContent = info.rpcUrl;

    // Check bot status
    updateBotStatus();

    // Set up listeners
    startBtn.addEventListener('click', startBot);
    stopBtn.addEventListener('click', stopBot);
    clearBtn.addEventListener('click', clearOutput);

    // Listen for bot output
    electronAPI.onBotOutput((data) => {
        addOutput(data);
        
        // Parse stats from output
        if (data.includes('Scan #')) {
            stats.scans++;
            updateStats();
        }
        if (data.includes('opportunities')) {
            const match = data.match(/(\d+)\s+opportunities/);
            if (match) {
                stats.opportunities += parseInt(match[1]);
                updateStats();
            }
        }
        if (data.includes('Trade executed')) {
            stats.trades++;
            updateStats();
        }
    });

    // Listen for status changes
    electronAPI.onBotStatus((status) => {
        updateBotStatus();
    });
}

async function startBot() {
    startBtn.disabled = true;
    addOutput('Starting bot...\n');
    
    const result = await electronAPI.startBot();
    
    if (result.success) {
        startTime = Date.now();
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusDot.className = 'dot running';
        statusText.textContent = 'Running';
        startUptime();
        addOutput('✅ Bot started successfully\n');
    } else {
        startBtn.disabled = false;
        addOutput(`❌ Failed to start: ${result.message}\n`);
    }
}

async function stopBot() {
    stopBtn.disabled = true;
    addOutput('Stopping bot...\n');
    
    const result = await electronAPI.stopBot();
    
    if (result.success) {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusDot.className = 'dot stopped';
        statusText.textContent = 'Stopped';
        stopUptime();
        addOutput('✅ Bot stopped\n');
    } else {
        stopBtn.disabled = false;
        addOutput(`❌ Failed to stop: ${result.message}\n`);
    }
}

function addOutput(text) {
    // Remove placeholder if exists
    const placeholder = output.querySelector('.output-placeholder');
    if (placeholder) {
        placeholder.remove();
    }

    // Add new output
    const lines = text.split('\n');
    lines.forEach(line => {
        if (line.trim()) {
            const div = document.createElement('div');
            div.className = 'output-line';
            div.textContent = line;
            output.appendChild(div);
        }
    });

    // Auto-scroll to bottom
    output.scrollTop = output.scrollHeight;
}

function clearOutput() {
    output.innerHTML = '<div class="output-placeholder">Output cleared...</div>';
    stats = { scans: 0, opportunities: 0, trades: 0 };
    updateStats();
}

async function updateBotStatus() {
    const status = await electronAPI.getBotStatus();
    
    if (status.running) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusDot.className = 'dot running';
        statusText.textContent = 'Running';
        if (!startTime) {
            startTime = Date.now();
            startUptime();
        }
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusDot.className = 'dot stopped';
        statusText.textContent = 'Stopped';
        stopUptime();
    }
}

function startUptime() {
    if (uptimeInterval) return;
    
    uptimeInterval = setInterval(() => {
        if (startTime) {
            const elapsed = Date.now() - startTime;
            const hours = Math.floor(elapsed / 3600000);
            const minutes = Math.floor((elapsed % 3600000) / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            uptimeEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
    }, 1000);
}

function stopUptime() {
    if (uptimeInterval) {
        clearInterval(uptimeInterval);
        uptimeInterval = null;
    }
    startTime = null;
    uptimeEl.textContent = '00:00:00';
}

function updateStats() {
    scanCountEl.textContent = stats.scans;
    opportunitiesCountEl.textContent = stats.opportunities;
    tradesCountEl.textContent = stats.trades;
}

// Initialize on load
init();
