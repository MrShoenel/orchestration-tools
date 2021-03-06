const EventEmitter = require('events').EventEmitter
, Rx = require('rxjs')
, Observable = Rx.Observable
, fromEvent = Rx.fromEvent
, symbolProgress = Symbol('progress');


/**
 * A class used to report progress of any kind. Supports events through
 * EventEmitter, own callbacks or being used as an Observable.
 * 
 * @template T
 * @extends {EventEmitter}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Progress extends EventEmitter {
	/**
	 * @param {callbackHandler<T>} handler a callback to be invoked for every
	 * progress reported. If not provided, you may subscribe to the events of
	 * this class or use the provided Observable.
	 */
	constructor(handler = void 0) {
		super();
		this.handler = handler;
		/** @type {T} */
		this.last = void 0;
	};

	/**
	 * Report the current progress, which is then broadcast to all listeners
	 * and passed to this handler.
	 * 
	 * @param {T} progress the item that represents the progress
	 * @returns {Progress} this
	 */
	reportProgress(progress) {
		this.last = progress;
		setTimeout(() => {
			this.emit(symbolProgress, progress);
			if (this.handler instanceof Function) {
				this.handler(progress);
			}
		}, 0);
		return this;
	};

	/**
	 * Returns an Rx.Observable that will emit events whenever they
	 * are reported to its subscribers.
	 * 
	 * @type {Observable<T>}
	 */
	get observable() {
		return fromEvent(this, symbolProgress);
	};
};


/**
 * A simple class to report numeric progress within a range
 * (typically [0, 1]), but any other positive range is good, too.
 * 
 * @extends {Progress<Number>}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ProgressNumeric extends Progress {
	/**
	 * @param {Number} progressMin the lowest possible value for the progress
	 * @param {Number} progressMax the largest possible value for the progress
	 * @param {callbackHandler<number>} handler a callback to be invoked for every
	 * progress reported. If not provided, you may subscribe to the events of
	 * this class or use the provided Observable.
	 */
	constructor(progressMin = 0, progressMax = 1, handler = void 0) {
		super(handler);
		const t = '[object Number]', v = x => Object.prototype.toString.call(x);

		if (v(progressMin) !== t || v(progressMax) !== t
			|| isNaN(progressMin) || isNaN(progressMax)) {
			throw new Error('Both progressMin and progressMax must be numeric.');
		}
		if (progressMin < 0 || progressMax < progressMin) {
			throw new Error('Both progressMin and progressMax must be positive and progressMax must be greater than progressMin.');
		}

		this.progressMin = progressMin;
		this.progressMax = progressMax;
		this.progressRange = progressMax - progressMin;
	};

	/**
	 * @type {Number}
	 */
	get percent() {
		return this.last === void 0 ? 0 :
			(this.last - this.progressMin) / this.progressRange;
	};

	/**
	 * @override
	 * @inheritdoc
	 * @param {Number} progress the numeric progress
	 * @returns {this}
	 */
	reportProgress(progress) {
		if (isNaN(progress) || progress < this.progressMin || progress > this.progressMax) {
			throw new Error(`The value "${progress}" is out of range.`);
		}

		return super.reportProgress(progress);
	};
};

module.exports = Object.freeze({
	Progress,
	ProgressNumeric,
	symbolProgress
});