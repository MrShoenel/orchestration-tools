const Rx = require('rxjs')
, Observable = Rx.Observable
, { Job, JobEvent, JobQueue, JobQueueEvent, symbolRun, symbolDone, symbolFailed,
	symbolIdle, JobQueueCapacityPolicy } = require('./lib/JobQueue')
, { JobQueueCapabilities } = require('./lib/JobQueueCapabilities')
, { Progress, ProgressNumeric, symbolProgress } = require('./lib/Progress')
, { Scheduler } = require('./lib/Scheduler')
, { Schedule, ScheduleEvent, symbolScheduleError, symbolScheduleComplete, PreliminaryScheduleEvent
	} = require('./lib/Schedule')
, { Interval, IntervalEventSimple, IntervalScheduler, symbolIntervalEvent
	} = require('./lib/IntervalScheduler')
, { ManualSchedule, ManualScheduleEventSimple, ManualScheduler, symbolManualSchedulerEvent
	} = require('./lib/ManualScheduler')
, { ProcessResult, ProcessErrorResult, ProcessExit,
	ProcessOutput, ProcessWrapper, symbolProcessOutput } = require('./lib/ProcessWrapper')
, { defer, deferMocha, timeout, DeferredClass } = require('./lib/tools/Defer')
, { assertThrowsAsync } = require('./lib/tools/AssertAsync')
, { deepCloneObject, mergeObjects } = require('./lib/tools/Objects')
, { getRandomNumber } = require('./lib/tools/Random')
, { Resolve } = require('./lib/tools/Resolve')
, { throwError, wrapError } = require('./lib/tools/Error')
, { formatError, formatValue } = require('./lib/tools/Format')
, { EqualityComparer, DefaultEqualityComparer } = require('./lib/collections/EqualityComparer')
, { Collection, CollectionEvent, symbolCollectionClear } = require('./lib/collections/Collection')
, { Queue, ConstrainedQueue, ProducerConsumerQueue, symbolQueueDequeue, symbolQueueEnqueue,
		symbolQueueTakeOut, ConstrainedQueueCapacityPolicy, ProducerConsumerQueueCapacityPolicy
	} = require('./lib/collections/Queue')
, { Stack, ConstrainedStack, symbolStackPop, symbolStackPush, symbolStackPopBottom
	} = require('./lib/collections/Stack')
, { LinkedList, LinkedListNode, LinkedListEvent, symbolLinkedListAdd, symbolLinkedListRemove
	} = require('./lib/collections/LinkedList')
, { Dictionary, DictionaryMapBased, symbolDictionaryDelete, symbolDictionaryGet, symbolDictionarySet
	} = require('./lib/collections/Dictionary')
, { Cache, CacheMapBased, CacheWithLoad, EvictionPolicy } = require('./lib/collections/Cache')
, { Comparer, DefaultComparer } = require('./lib/collections/Comparer')
, docs = require('./docs');


module.exports = {
	Rx, Observable,
	Job, JobEvent, JobQueue, JobQueueEvent, symbolRun, symbolDone, symbolFailed, symbolIdle,
	JobQueueCapabilities, JobQueueCapacityPolicy,
	Progress, ProgressNumeric, symbolProgress,
	Scheduler,
	Schedule, ScheduleEvent, symbolScheduleError, symbolScheduleComplete, PreliminaryScheduleEvent,
	Interval, IntervalEventSimple, IntervalScheduler, symbolIntervalEvent,
	ManualSchedule, ManualScheduleEventSimple, ManualScheduler, symbolManualSchedulerEvent,
	ProcessResult, ProcessErrorResult, ProcessExit,
	ProcessOutput, ProcessWrapper, symbolProcessOutput,
	defer, deferMocha, timeout, DeferredClass,
	assertThrowsAsync,
	deepCloneObject, mergeObjects,
	getRandomNumber,
	Resolve,
	throwError, wrapError,
	formatError, formatValue,
	EqualityComparer, DefaultEqualityComparer,
	Collection, CollectionEvent, symbolCollectionClear,
	Queue, ConstrainedQueue, ProducerConsumerQueue, symbolQueueDequeue, symbolQueueEnqueue,
	symbolQueueTakeOut, ConstrainedQueueCapacityPolicy, ProducerConsumerQueueCapacityPolicy,
	Stack, ConstrainedStack, symbolStackPop, symbolStackPush, symbolStackPopBottom,
	LinkedList, LinkedListNode, LinkedListEvent, symbolLinkedListAdd, symbolLinkedListRemove,
	Dictionary, DictionaryMapBased, symbolDictionaryDelete, symbolDictionaryGet, symbolDictionarySet,
	Cache, CacheMapBased, CacheWithLoad, EvictionPolicy,
	Comparer, DefaultComparer,
	docs
};
