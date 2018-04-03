require('../docs');

const cp = require('child_process')
, fs = require('fs')
, fsX = require('fs-extra')
, path = require('path')
, copy = require('recursive-copy');



class Backup {
  /**
   * @param {String} sevenZip path to 7z
   * @param {BackupOptions} options 
   */
  constructor(sevenZip, options) {
    this.sevenZip = sevenZip;
    this.options = options;
    this.name = options.name;
    this.intervalMSecs = options.intervalMinutes * 60 * 1e3;
    this.intervalErrorMSecs = options.intervalErrorMinutes * 60 * 1e3;
  };

  get destinationFileName() {
    const pad = num => `${num < 10 ? '0' : ''}${num}`,
      now = new Date;

    return path.resolve(this.options.dest
      .replace('%jobname%', this.name)
      .replace('%timestamp%', `${((+now) / 1e3).toFixed(0)}`))
      .replace('%date%', `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`)
      .replace('%time%', `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`);
  };

  /**
   * @param {BackupTask|InternalBackupTask} task
   * @param {any} prevResult the result (if any) from the task that run previously. This is only passed to InternalBackupTasks that are of kind function.
   * @returns {Promise.<any>}
   */
  async _mapInternalTask(task, prevResult) {
    if (task === '@emptyDest') {
      return await fsX.emptyDir(this.options.dest);
    } else if (task instanceof Function) {
      const args = prevResult === void 0 ? [] : [prevResult];
      const result = task.apply(null, args);

      if (result instanceof Promise) {
        return await result;
      } else {
        return result;
      }
    } else if (Array.isArray(task)) {
      return await Backup.runProcess(task.exec, task.args);
    }

    throw new Error(`The task "${JSON.stringify(task)}" is not supported.`);
  };

  async _runTasksBefore() {
    return await this._runTasks(this.options.tasksBefore);
  };

  async _runTasksAfter() {
    return await this._runTasks(this.options.tasksAfter);
  };

  /**
   * @param {Array.<BackupTask>} tasks
   * @returns {Promise.<void>}
   */
  async _runTasks(tasks) {
    const tasksToRun = (tasks || []).slice(0);

    let previousResult = void 0;

    for (let task of tasksToRun) {
      try {
        previousResult = await this._mapInternalTask(task, previousResult);
      } catch (e) {
        if (!task.allowFail) {
          throw e;
        }
      }
    }
  };

  /**
   * Evaluates whether the backup should be skipped at this point in time.
   * 
   * @returns {Promise.<boolean>}
   */
  async _runSkipper() {
    if (typeof this.options.skipBackup === 'function') {
      const value = this.options.skipBackup();
      let skipValue = false;

      if (value instanceof Promise) {
        skipValue = await value;
      } else {
        skipValue = value;
      }

      if (skipValue === true || skipValue === false) {
        return skipValue;
      }

      throw new Error(
        `The evaluation for 'skipValue' or its promise did not return a boolean value.`);
    }

    // Not used; do not skip the backup -> return false
    return false;
  };

  /**
   * 
   * @param {string} executable 
   * @param {Array.<string>} args 
   * @returns {Promise.<Array.<string>>} array of strings: error/signal-code, stdout, stderr of the process
   */
  static runProcess(executable, args) {
    return new Promise((resolve, reject) => {
      const shutdownFunc = (() => {
        let calledAlready = false;
  
        /**
         * @param {boolean} faulted
         * @param {Array.<string>} data
         */
        return (faulted, data) => {
          if (!calledAlready) {
            calledAlready = true;
            faulted ? reject(data) : resolve(data);
          }
        };
      })();
  
      const stdOut = [], stdErr = [];
      const proc = cp.spawn(executable, args)
        .once('error', err =>
          shutdownFunc(true, [err, stdOut.join(''), stdErr.join('')]))
        .once('exit', (code, sig) =>
          shutdownFunc(code !== 0, [`${sig}-${code}`, stdOut.join(''), stdErr.join('')]));
  
      proc.stdout.on('data', chunk => stdOut.push(chunk.toString()));
      proc.stderr.on('data', chunk => stdErr.push(chunk.toString()));
    });
  };

  /**
   * Runs the whole backup process. It evaluates whether the backup shall be skipped.
   * Then the tasksBefore are run, then the actual backup, then the tasksAfter.
   * 
   * @returns {Promise.<void>}
   */
  async run() {
    if (await this._runSkipper()) {
      return; // Skip it.
    }

    await this._runTasksBefore();
  
    if (this.options.mode === 'zip') {
      await Backup.runProcess(this.sevenZip, ['a'].concat(this.options.sevenZipArgs.concat([
        this.destinationFileName, this.options.src]))).catch(err => {
          fs.exists(this.destinationFileName, exists => {
            fs.unlink(this.destinationFileName, _ => { });
          });
          throw err;
        });
    } else if (this.options.mode === 'copy') {
      await copy(this.options.src, this.destinationFileName, {
        overwrite: true,
        expand: true,
        dot: true,
        junk: true
      });
    } else if (this.options.mode === 'tasksOnly') {
      // Do nothing, but let's keep this block.
    } else {
      await Promise.reject(`The mode "${this.options.mode}" is not supported.`);
    }

    await this._runTasksAfter();
  };
};

module.exports = Backup;
