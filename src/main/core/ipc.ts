import {electronApp, is, platform} from '@electron-toolkit/utils';
import {exec, spawn} from 'child_process';
import {app, BrowserWindow, globalShortcut, ipcMain, nativeTheme, shell} from 'electron';
import fs from 'fs-extra';

import path, {join} from 'path';
import logger from './logger';
import {setting} from './db/service';
import puppeteerInElectron from '../utils/pie';
import {toggleWindowVisibility} from '../utils/tool';
import {createMain, createPlay, getWin} from './winManger';

const tmpDir = async (path: string) => {
  try {
    const pathExists = await fs.pathExistsSync(path);
    logger.info(`[ipcMain] tmpDir: ${path}-exists-${pathExists}`);
    if (pathExists) {
      await fs.removeSync(path); // 删除文件, 不存在不会报错
    }
    await fs.emptyDirSync(path); // 清空目录, 不存在自动创建
    logger.info(`[ipcMain] tmpDir: ${path}-created-success`);
  } catch (err) {
    logger.error(err);
  }
};

function runCommand(event, command, element) {
  return new Promise((resolve, reject) => {
    const child = spawn('cmd.exe', ['/c', `chcp 65001 && ${command}`], {
      shell: true // 使用 shell 运行命令
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      let msg = data.toString();
      stdout += msg;
      console.log('stdout:' + msg);
      element.msg = stdout;
      element.status = 1;
      event.sender.send('download-progress', element);
    });

    child.stderr.on('data', (data) => {
      let msg = data.toString();
      stderr += msg;
      console.log('stderr:' + msg);
      element.msg = stderr;
      element.status = 1;
      event.sender.send('download-progress', element);
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log('close');
        element.msg = stdout;
        element.status = 0;
        event.sender.send('download-progress', element);
        resolve(stdout);
      } else {
        let msg = `命令失败，退出码: ${code}\n错误输出: ${stderr}`;
        console.log('Error:' + msg);
        element.msg = msg;
        element.status = 1;
        event.sender.send('download-progress', element);
        reject(new Error(msg));
      }
    });

  });
}

const ipcListen = () => {
  ipcMain.on('exec-download', async (event, params: any) => {
    let parse = JSON.parse(params);

    for (let key in parse) {
      let element = parse[key];
      element.msg = ''
      let command = `"C:\\Program Files\\N_m3u8DL-RE_Beta_win-x64\\N_m3u8DL-RE.exe" "${element.value}" --save-dir "C:\\Program Files\\N_m3u8DL-RE_Beta_win-x64\\${element.title}" --save-name "${element.title}-${element.label}"`;
      const file = path.join('C:\\Program Files\\N_m3u8DL-RE_Beta_win-x64', element.title, `${element.title}-${element.label}`);
      fs.access(file, fs.constants.F_OK, (err) => {
        if (!err) {
          fs.unlink(file, (err) => {
            if (err) {
              console.error('删除文件时出错:', err);
            } else {
              console.log('文件已删除');
            }
          });
        }
      });
      await runCommand(event, command, element);
    }
  });

  ipcMain.on('uninstallShortcut', () => {
    logger.info(`[ipcMain] globalShortcut unregisterAll`);
    globalShortcut.unregisterAll();
  });

  ipcMain.on('toggle-selfBoot', (_, status) => {
    logger.info(`[ipcMain] set-selfBoot: ${status}`);
    electronApp.setAutoLaunch(status);
  });

  ipcMain.on('open-proxy-setting', () => {
    logger.info(`[ipcMain] open-proxy-setting`);
    if (platform.isWindows) shell.openPath('ms-settings:network-proxy');
    if (platform.isMacOS) shell.openExternal('x-apple.systempreferences:com.apple.preference.network?Proxies');
    if (platform.isLinux) shell.openPath('gnome-control-center network');
  });

  ipcMain.on('call-player', (_, path: string, url: string) => {
    if (url && path) {
      const command = `${path} "${url}"`;
      exec(command);
      logger.info(`[ipcMain] call-player: command:${command}`);
    }
  });

  const getFolderSize = (folderPath: string): number => {
    let totalSize = 0;

    if (fs.existsSync(folderPath)) {
      const entries = fs.readdirSync(folderPath);

      for (const entry of entries) {
        const entryPath = join(folderPath, entry);
        const entryStats = fs.statSync(entryPath);

        if (entryStats.isFile()) {
          totalSize += entryStats.size;
        } else if (entryStats.isDirectory()) {
          totalSize += getFolderSize(entryPath);
        }
      }
    }

    return totalSize;
  };

  ipcMain.on('tmpdir-manage', (event, action, trails) => {
    let formatPath = join(app.getPath('userData'), trails);
    if (action === 'rmdir' || action === 'mkdir' || action === 'init') tmpDir(formatPath);
    if (action === 'make') fs.ensureDirSync(formatPath);
    if (action === 'size') event.reply('tmpdir-manage-size', getFolderSize(formatPath));
  });

  ipcMain.handle('ffmpeg-thumbnail', async (_, url, key) => {
    let uaState: any = setting.find({key: 'ua'}).value;
    const formatPath = is.dev
      ? join(process.cwd(), 'thumbnail', `${key}.jpg`)
      : join(app.getPath('userData'), 'thumbnail', `${key}.jpg`);

    const ffmpegCommand = 'ffmpeg'; // ffmpeg 命令
    const inputOptions = ['-i', url]; // 输入选项，替换为实际视频流 URL
    const outputOptions = [
      '-y', // 使用 -y 选项强制覆盖输出文件
      '-frames:v',
      '1',
      '-q:v',
      '20', // 设置输出图片质量为5
      '-user_agent',
      `"${uaState}"`,
      `"${formatPath}"`,
    ];
    const command = [ffmpegCommand, ...outputOptions, ...inputOptions].join(' '); // 确保 -user_agent 选项位于输入 URL 之前

    try {
      await exec(command);
      const isGenerat = fs.existsSync(formatPath);
      logger.info(`[ipcMain] ffmpeg-thumbnail status:${isGenerat} command:${command}`);
      return {
        key,
        url: `file://${formatPath}`,
      };
    } catch (err) {
      logger.error(`[ipcMain] Error generating thumbnail: ${err}`);
      return {
        key,
        url: '',
      };
    }
  });

  ipcMain.handle('ffmpeg-installed-check', async () => {
    try {
      const {stdout} = await exec('ffmpeg -version');
      logger.info(`[ipcMain] FFmpeg is installed. ${stdout}`);
      return true;
    } catch (err) {
      logger.error(`[ipcMain] Error Ffmpeg Installed Check: ${err}`);
      return false;
    }
  });

  ipcMain.handle('sniffer-media', async (_, url, run_script, init_script, customRegex) => {
    const ua = setting.find({key: 'ua'}).value;
    const res = await puppeteerInElectron(url, run_script, init_script, customRegex, ua);
    return res;
  });

  ipcMain.handle('read-file', async (_, path) => {
    const fileContent = await fs.readFileSync(path, 'utf8').toString();
    const res = fileContent ? fileContent : '';
    logger.info(res);

    return res;
  });

  ipcMain.on('open-url', async (_, url) => {
    shell.openExternal(url);
  });

  ipcMain.on('open-path', async (_, file, create) => {
    const path = join(app.getPath('userData'), file);
    // 查看目录是否存在，如果不存在，就创建一个
    if (create) fs.ensureDirSync(path);
    shell.openPath(path);
  });

  ipcMain.handle('read-path', async (_, type) => {
    const path = app.getPath(type);
    return path;
  });

  ipcMain.handle('path-join', (_, fromPath, toPath) => {
    return join(fromPath, toPath);
  });

  // 重启app
  ipcMain.on('reboot-app', () => {
    logger.info(`[ipcMain] reboot-app`);
    app.relaunch();
    app.exit(); // 直接强制关闭
    // app.quit(); // 生命周期, 有回调函数
  });

  // 关闭app
  ipcMain.on('quit-app', () => {
    app.quit();
  });

  ipcMain.on('openPlayWindow', (_, _arg) => {
    createPlay();
  });

  ipcMain.on('showMainWin', () => {
    logger.info(`[ipcMain] show main windows`);
    const win = getWin('main');
    if (!win || win.isDestroyed()) {
      createMain();
    } else {
      win.show();
    }
  });

  ipcMain.on('updateShortcut', (_, {shortcut}) => {
    logger.info(`[ipcMain] storage-shortcuts: ${shortcut}`);
    globalShortcut.unregisterAll();
    logger.info(`[ipcMain] globalShortcut-install: ${shortcut}`);
    globalShortcut.register(shortcut, () => {
      toggleWindowVisibility();
    });
  });

  ipcMain.on('manage-playerWindow', (_, action) => {
    logger.info(`[ipcMain] playerWindow: action is ${action}`);
    const win = getWin('play');
    if (action === 'destroy') {
      win?.destroy();
    } else if (action === 'focus') {
      win?.focus();
    }
  });

  ipcMain.on('updateDns', (_, item) => {
    logger.info(`[ipcMain] new dns: ${item}`);
    if (item) {
      app.configureHostResolver({
        secureDnsMode: 'secure',
        secureDnsServers: [item],
      });
    } else {
      app.configureHostResolver({
        secureDnsMode: 'off',
      });
    }
  });

  // 事件广播通知
  ipcMain.handle('event-broadcast', (event, eventInfo) => {
    // 遍历window执行
    for (const currentWin of BrowserWindow.getAllWindows()) {
      // 注意，这里控制了发送广播的窗口，不触发对应事件，如果需要自身也触发的话，删除if内的逻辑即可
      if (event) {
        const webContentsId = currentWin.webContents.id;
        if (webContentsId === event.sender.id) {
          continue;
        }
      }
      currentWin.webContents.send(eventInfo.channel, eventInfo.body);
    }
  });

  // 主题更新事件
  nativeTheme.on('updated', () => {
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    const mainWin = getWin('main');
    const playWin = getWin('play');
    if (mainWin) mainWin.webContents.send('system-theme-updated', `${isDarkMode ? 'dark' : 'light'}`);
    if (playWin) playWin.webContents.send('system-theme-updated', `${isDarkMode ? 'dark' : 'light'}`);
    logger.info(`[nativeTheme] System-theme-updated: ${isDarkMode ? 'dark' : 'light'} ; send to vue app`);
  });
};

export {ipcListen, tmpDir};
