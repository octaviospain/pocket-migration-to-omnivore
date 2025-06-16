import readline from 'readline';

// Colors for logging
const Colors = {
    RED: '\x1b[0;31m',
    GREEN: '\x1b[0;32m',
    YELLOW: '\x1b[1;33m',
    BLUE: '\x1b[0;34m',
    NC: '\x1b[0m' // No Color
};

export class Logger {
    static info(message) {
        console.log(`${Colors.BLUE}[INFO]${Colors.NC} ${message}`);
    }

    static success(message) {
        console.log(`${Colors.GREEN}[SUCCESS]${Colors.NC} ${message}`);
    }

    static error(message) {
        console.log(`${Colors.RED}[ERROR]${Colors.NC} ${message}`);
    }

    static warning(message) {
        console.log(`${Colors.YELLOW}[WARNING]${Colors.NC} ${message}`);
    }

    static clearLine() {
        if (process.stdout.isTTY) {
            readline.clearLine(process.stdout, 0);
            readline.cursorTo(process.stdout, 0);
        }
    }

    static updateProgress(current, total, currentTitle = '') {
        if (!process.stdout.isTTY) {
            // Fallback for non-TTY environments
            if (current % 5 === 0 || current === total) {
                console.log(`Progress: ${current}/${total} articles processed`);
            }
            return;
        }

        this.clearLine();
        const percentage = Math.round((current / total) * 100);
        const progressBar = this.createProgressBar(current, total, 30);
        const truncatedTitle = currentTitle.length > 50 ? `${currentTitle.substring(0, 47)}...` : currentTitle;

        process.stdout.write(
            `${Colors.BLUE}[PROGRESS]${Colors.NC} ${progressBar} ${percentage}% (${current}/${total}) ${truncatedTitle}`
        );

        if (current === total) {
            process.stdout.write('\n');
        }
    }

    static createProgressBar(current, total, width = 30) {
        const filledWidth = Math.round((current / total) * width);
        const emptyWidth = width - filledWidth;
        const filled = '█'.repeat(filledWidth);
        const empty = '░'.repeat(emptyWidth);
        return `${Colors.GREEN}${filled}${Colors.NC}${empty}`;
    }

    static finalizeProgress() {
        if (process.stdout.isTTY) {
            process.stdout.write('\n');
        }
    }
}
