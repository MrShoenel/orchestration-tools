const { Collection } = require('./collections/Collection')
, { EqualityComparer } = require('./collections/EqualityComparer')
, { getRandomNumber } = require('./tools/Random');


/**
 * This enumeration holds supported selection strategies for the class
 * @see {ResourceSelector}.
 * 
 * @readonly
 * @enum {Number}
 */
const ResourceSelectionStrategy = {
	/**
	 * The @see {ResourceSelector} will throw without a strategy.
	 */
	None: 0,
	/**
	 * Randomly select
	 */
	Random: 1,
	/**
	 * Least-recently used
	 */
	LRU: 2,
	/**
	 * Least-used
	 */
	LU: 3,
	/**
	 * Most-recently used
	 */
	MRU: 4,
	/**
	 * Most-used
	 */
	MU: 5,
	/**
	 * Least-recently added
	 */
	LRA: 6,
	/**
	 * Most-recently added
	 */
	MRA: 7,
	/**
	 * Round-Robin
	 */
	RoundRobin: 8
};


/**
 * Encapsulate any item that is a resource.
 * 
 * @template T
 * @author Sebastian Hönel <development@hoenel.net>
 */
class Resource {
	/**
	 * @param {T} resource The actual resource
	 */
	constructor(resource) {
		/** @protected */
		this._resource = resource;
		/** @protected */
		this._numUsed = 0;
		/** @protected */
		this._created = Date.now();
		/**
		 * @protected
		 * @type {Number}
		 */
		this._lastUsed = null;
	};

	get numUsed() {
		return this._numUsed;
	};

	get created() {
		return this._created;
	};

	get lastUsed() {
		return this._lastUsed;
	};

	/**
	 * Obtain the resource and increase the internal use-counter
	 * and last-used date.
	 * 
	 * @returns {T} The underlying resource.
	 */
	use() {
		this._numUsed++;
		this._lastUsed = Date.now();
		return this._resource;
	};
};


/**
 * Given any number of resources, this class helps to select an appropriate
 * resource by a pre-defined strategy, such as least-recently used.
 * 
 * @template T
 * @extends {Collection<Resource<T>>}
 * @author Sebastian Hönel <development@hoenel.net>
 */
class ResourceSelector extends Collection {
	/**
	 * @param {ResourceSelectionStrategy|Number} strategy
	 * @param {EqualityComparer<T>} eqComparer
	 */
	constructor(strategy = ResourceSelectionStrategy.RoundRobin, eqComparer = EqualityComparer.default) {
		super(eqComparer);

		/**
		 * @protected
		 * @type {ResourceSelectionStrategy|Number}
		 */
		this._strategy = null;
		this.strategy = strategy;
	};

	/**
	 * @protected
	 * @param {ResourceSelectionStrategy|Number} strategy
	 * @throws {Error} If the given strategy is not valid.
	 * @returns {ResourceSelectionStrategy}
	 */
	_validateStrategy(strategy) {
		switch (strategy) {
			case ResourceSelectionStrategy.None:
			case ResourceSelectionStrategy.Random:
			case ResourceSelectionStrategy.LRU:
			case ResourceSelectionStrategy.LU:
			case ResourceSelectionStrategy.MRU:
			case ResourceSelectionStrategy.MU:
			case ResourceSelectionStrategy.LRA:
			case ResourceSelectionStrategy.MRA:
			case ResourceSelectionStrategy.RoundRobin:
				return strategy;
			default:
				throw new Error(`The strategy '${strategy}' is not known.`);
		}
	};

	/**
	 * @type {ResourceSelectionStrategy|Number}
	 */
	get strategy() {
		return this._strategy;
	};

	/**
	 * @param {ResourceSelectionStrategy|Number} strategy
	 */
	set strategy(strategy) {
		this._strategy = this._validateStrategy(strategy);
	};

	/**
	 * @type {Boolean}
	 */
	get hasResources() {
		return this._items.length > 0;
	};

	/**
	 * @param {T} resource A resource
	 * @throws {Error} If the resource was added previously.
	 * @returns {this}
	 */
	addResource(resource) {
		if (this.hasResource(resource)) {
			throw new Error('This resource has already been added.');
		}
		this._items.push(new Resource(resource));
		return this;
	};

	/**
	 * Note that this method compares the actual resource (@see {T}),
	 * not its wrapper @see {Resource<T>}.
	 * 
	 * @param {T} resource
	 * @returns {Boolean}
	 */
	hasResource(resource) {
		const idx = this._items.findIndex(res =>
			this.equalityComparer.equals(res._resource, resource));
		return idx >= 0;
	};

	/**
	 * Remove a previously added resource from this selector.
	 * 
	 * @param {T} resource The resource to remove.
	 * @returns {this}
	 */
	removeResource(resource) {
		const idx = this._items.findIndex(res =>
			this.equalityComparer.equals(res._resource, resource));

		if (idx < 0) {
			throw new Error('Unknown resource.');
		}
		this._items.splice(idx, 1);

		return this;
	};

	/**
	 * The main method to select the next resource. You must not rely on the
	 * expected order if all resources are yet unused
	 * 
	 * @returns {Resource<T>} The next resource, according to the currently
	 * selected strategy. It can be used by calling @see {Resource.use()}.
	 */
	select() {
		if (!this.hasResources) {
			throw new Error('No resources available.');
		}

		/** @type {Array<Resource<T>>} */
		let sort = null;

		switch (this.strategy) {
			case ResourceSelectionStrategy.RoundRobin:
				const res = this._items.shift();
				this._items.push(res);
				return res;
			case ResourceSelectionStrategy.Random:
				return this._items.sort(() => getRandomNumber())[1];
			case ResourceSelectionStrategy.LU:
			case ResourceSelectionStrategy.MU:
				sort = this.asArray.sort((a, b) => a.numUsed - b.numUsed);
				return this.strategy === ResourceSelectionStrategy.LU ? sort.shift() : sort.pop();
			case ResourceSelectionStrategy.LRU:
			case ResourceSelectionStrategy.MRU:
				sort = this.asArray.sort((a, b) => {
					if (a.lastUsed === null) {
						return -1;
					} else if (b.lastUsed === null) {
						return 1;
					}
					return a.lastUsed - b.lastUsed;
				});
				return this.strategy === ResourceSelectionStrategy.LRU ? sort.shift() : sort.pop();
			case ResourceSelectionStrategy.LRA:
			case ResourceSelectionStrategy.MRA:
				sort = this.asArray.sort((a, b) => a.created - b.created);
				return this.strategy === ResourceSelectionStrategy.LRA ? sort.shift() : sort.pop();
			case ResourceSelectionStrategy.None:
			default:
				throw new Error('No selection strategy selected.');
		}
	};
};


module.exports = Object.freeze({
	Resource,
	ResourceSelectionStrategy,
	ResourceSelector
});
