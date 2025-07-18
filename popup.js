class PomodoroTimer {
    constructor() {
        this.initializeElements();
        this.loadSettings();
        this.loadTimerState();
        this.setupEventListeners();
        this.updateDisplay();
        
        // Update display every second
        setInterval(() => this.updateDisplay(), 1000);
    }

    initializeElements() {
        this.timeDisplay = document.getElementById('timeDisplay');
        this.sessionInfo = document.getElementById('sessionInfo');
        this.statusDisplay = document.getElementById('statusDisplay');
        
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        
        this.focusTimeInput = document.getElementById('focusTime');
        this.breakTimeInput = document.getElementById('breakTime');
        this.longBreakTimeInput = document.getElementById('longBreakTime');
        this.sessionsCountInput = document.getElementById('sessionsCount');
        this.autoStartInput = document.getElementById('autoStart');
        this.saveSettingsBtn = document.getElementById('saveSettings');
    }

    setupEventListeners() {
        this.startBtn.addEventListener('click', () => this.startTimer());
        this.pauseBtn.addEventListener('click', () => this.pauseTimer());
        this.resetBtn.addEventListener('click', () => this.resetTimer());
        this.saveSettingsBtn.addEventListener('click', () => this.saveSettings());
    }

    loadSettings() {
        chrome.storage.local.get([
            'focusTime', 'breakTime', 'longBreakTime', 
            'sessionsCount', 'autoStart'
        ], (result) => {
            this.focusTimeInput.value = result.focusTime || 25;
            this.breakTimeInput.value = result.breakTime || 5;
            this.longBreakTimeInput.value = result.longBreakTime || 15;
            this.sessionsCountInput.value = result.sessionsCount || 4;
            this.autoStartInput.checked = result.autoStart || false;
        });
    }

    loadTimerState() {
        chrome.storage.local.get([
            'isRunning', 'isPaused', 'currentSession', 'isBreak', 
            'timeLeft', 'totalSessions', 'currentPhase'
        ], (result) => {
            this.isRunning = result.isRunning || false;
            this.isPaused = result.isPaused || false;
            this.currentSession = result.currentSession || 1;
            this.isBreak = result.isBreak || false;
            this.timeLeft = result.timeLeft || (parseInt(this.focusTimeInput.value) * 60);
            this.totalSessions = result.totalSessions || parseInt(this.sessionsCountInput.value);
            this.currentPhase = result.currentPhase || 'focus';
            
            this.updateButtonStates();
        });
    }

    saveSettings() {
        const settings = {
            focusTime: parseInt(this.focusTimeInput.value),
            breakTime: parseInt(this.breakTimeInput.value),
            longBreakTime: parseInt(this.longBreakTimeInput.value),
            sessionsCount: parseInt(this.sessionsCountInput.value),
            autoStart: this.autoStartInput.checked
        };

        chrome.storage.local.set(settings, () => {
            this.showNotification('Settings saved successfully!');
            // Force update display after settings are saved
            setTimeout(() => this.updateDisplay(), 100);
        });

        // Send settings to service worker
        chrome.runtime.sendMessage({
            action: 'updateSettings',
            settings: settings
        }, (response) => {
            if (response && response.success) {
                // Update display immediately after service worker confirms update
                this.updateDisplay();
            }
        });
    }

    startTimer() {
        chrome.runtime.sendMessage({ action: 'startTimer' }, (response) => {
            if (response && response.success) {
                this.isRunning = true;
                this.isPaused = false;
                this.updateButtonStates();
            }
        });
    }

    pauseTimer() {
        chrome.runtime.sendMessage({ action: 'pauseTimer' }, (response) => {
            if (response && response.success) {
                this.isRunning = false;
                this.isPaused = true;
                this.updateButtonStates();
            }
        });
    }

    resetTimer() {
        chrome.runtime.sendMessage({ action: 'resetTimer' }, (response) => {
            if (response && response.success) {
                this.isRunning = false;
                this.isPaused = false;
                this.currentSession = 1;
                this.isBreak = false;
                this.currentPhase = 'focus';
                this.timeLeft = parseInt(this.focusTimeInput.value) * 60;
                this.updateButtonStates();
                this.updateDisplay();
            }
        });
    }

    updateButtonStates() {
        if (this.isRunning) {
            this.startBtn.disabled = true;
            this.pauseBtn.disabled = false;
            this.startBtn.textContent = 'Running...';
        } else if (this.isPaused) {
            this.startBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.startBtn.textContent = 'Resume';
        } else {
            this.startBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.startBtn.textContent = 'Start';
        }
    }

    updateDisplay() {
        chrome.storage.local.get([
            'timeLeft', 'currentSession', 'totalSessions', 
            'currentPhase', 'isRunning', 'isPaused'
        ], (result) => {
            const timeLeft = result.timeLeft || this.timeLeft || 0;
            const currentSession = result.currentSession || 1;
            const totalSessions = result.totalSessions || parseInt(this.sessionsCountInput.value);
            const currentPhase = result.currentPhase || 'focus';
            const isRunning = result.isRunning || false;
            const isPaused = result.isPaused || false;

            // Update time display
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            this.timeDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            // Update session info
            this.sessionInfo.textContent = `Session ${currentSession} of ${totalSessions}`;

            // Update status
            let status = '';
            let statusClass = '';
            
            if (isRunning) {
                if (currentPhase === 'focus') {
                    status = '🎯 Focus Time - Stay concentrated!';
                    statusClass = 'working';
                } else if (currentPhase === 'shortBreak') {
                    status = '☕ Short Break - Relax a bit!';
                    statusClass = 'break';
                } else if (currentPhase === 'longBreak') {
                    status = '🌟 Long Break - Well deserved!';
                    statusClass = 'break';
                }
            } else if (isPaused) {
                status = '⏸️ Paused';
                statusClass = 'paused';
            } else {
                status = '▶️ Ready to start';
                statusClass = '';
            }

            this.statusDisplay.textContent = status;
            this.statusDisplay.className = `status ${statusClass}`;

            // Update button states
            this.isRunning = isRunning;
            this.isPaused = isPaused;
            this.updateButtonStates();
        });
    }

    showNotification(message) {
        // Create a temporary notification element
        const notification = document.createElement('div');
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #27ae60;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 2000);
    }
}

// Initialize the timer when the popup loads
document.addEventListener('DOMContentLoaded', () => {
    new PomodoroTimer();
});