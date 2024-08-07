import { fileURLToPath } from 'url';
import * as fs from 'fs';

const LOGS_DIR = './logs';

function getCurrentFileName(): string {
    let today = new Date();
    let dd = String(today.getDate()).padStart(2, '0');
    let mm = String(today.getMonth() + 1).padStart(2, '0'); //January is 0!
    let yyyy = today.getFullYear();

    let today_row = mm + '-' + dd + '-' + yyyy;

    return `${LOGS_DIR}/${today_row}.log`;
}


export var globallevel = {
    levelIndex: 0
};


export function writeToFile(message: string) {
    fs.appendFile(getCurrentFileName(), message + '\n', (err: any) => {
        if (err) {
            console.error(err);
        }
    }
    );
}

const LEVELS = ['DEBUG', 'INFO', 'ERROR'];

export function setLevel(level: 'DEBUG' | 'INFO' | 'ERROR'): void {
    globallevel.levelIndex = LEVELS.indexOf(level.toUpperCase())
}

function formatMessage(level: 'DEBUG' | 'INFO' | 'ERROR', message: string, colors: boolean=true): string {
    const currentTime = new Date();
    const hours = currentTime.getHours().toString().padStart(2, '0');
    const minutes = currentTime.getMinutes().toString().padStart(2, '0');
    const seconds = currentTime.getSeconds().toString().padStart(2, '0')
    const now = `${hours}:${minutes}:${seconds}`;

    const filePath = fileURLToPath(import.meta.url).replace(/^.*[\\/]/, '');
    const levelColor = level === 'DEBUG'? '\x1b[36m%s\x1b[0m' :
                          level === 'INFO'? '\x1b[32m%s\x1b[0m' :
                          level === 'ERROR'? '\x1b[31m%s\x1b[0m' :
                                              '\x1b[37m%s\x1b[0m';
    if (!colors) {
        return `[${now}] [${level}] ${filePath}: ${message}`;
    }
    return levelColor.replace('%s', `[${now}] [${level}] ${filePath}: ${message}`);
}

export function debug(message: string): void {
    if (globallevel.levelIndex <= LEVELS.indexOf('DEBUG')) {
            console.log(formatMessage('DEBUG', message));
            writeToFile(formatMessage('DEBUG', message, false));
    }
}

export function info(message: string): void {
    if (globallevel.levelIndex <= LEVELS.indexOf('INFO')) {
            console.log(formatMessage('INFO', message));
            writeToFile(formatMessage('INFO', message, false));
    }
}

export function error(message: string): void {
    if (globallevel.levelIndex <= LEVELS.indexOf('ERROR')) {
        console.log(formatMessage('ERROR', message));
        writeToFile(formatMessage('ERROR', message, false));
    }
}