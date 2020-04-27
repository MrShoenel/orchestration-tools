# OrchestrationTools
Collection of `orchestration-tools` that help building an infrastructure or to orchestrate resources through NodeJS. Also comes with universal tools such as collections.

|Version|Coverage|Vulnerabilities|Master|Master-pre-v2.0.0|
|:-|:-|:-|:-|:-|
|[![Current Version](https://img.shields.io/npm/v/sh.orchestration-tools.svg)](https://www.npmjs.com/package/sh.orchestration-tools)|[![Coverage Status](https://coveralls.io/repos/github/MrShoenel/orchestration-tools/badge.svg?branch=master)](https://coveralls.io/github/MrShoenel/orchestration-tools?branch=master)|[![Vulnerabilities](https://snyk.io/test/github/MrShoenel/orchestration-tools/badge.svg)](https://snyk.io/test/github/MrShoenel/orchestration-tools)|[![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master)](https://travis-ci.org/MrShoenel/orchestration-tools)|[![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master-pre-v2.0.0)](https://travis-ci.org/MrShoenel/orchestration-tools)|


## Install from npm
This package can be installed using the following command: `npm install sh.orchestration-tools`.

Please note that between `v1.8.0` and `v2.0.0` there were breaking changes regarding `Progress` itself and how it is handled in conjunction with `Job`. If you therefore need to stick with `v1.x.x`, please use the latest stable from the `master-pre-v2.0.0`-branch.

## Current list of included tools
* __Job__ - a class that can encapsulate and represent any (asynchronous) work. Supports `Promise`-based work, enhanced states, simple eventing and progress. As of `v2.1.0`, __JobWithCost__ has been removed and cost is now supported by Job.
* __JobQueue__ - a queue that supports parallel jobs with free degree of parallelism.
* __JobQueueCapabilities__ - an extension to the `JobQueue` that can manage and run jobs based on their cost, rather than on plain parallelism.
* __Progress__ - a class used to report any kind of (generic) progress. Supports callbacks, events and `Observables` through `RxJS`.
* __ProgressNumeric__ - an extension (and simplification) of `Progress` especially for numeric progress.
* __CalendarScheduler__ and __Calendar__ provide mechanism to schedule jobs based on `iCal`-calendars from any source (new in `v1.4.0`).
* __IntervalScheduler__ and __Interval__ provide a scheduling mechanism to schedule using timeouts or intervals (new in `v1.6.0`). Also, the schedulers now have a common base-class (`Scheduler`) and their schedules have one, too (`Schedule`).
* __ProcessWrapper__ and related classes (such as `ProcessResult` and `ProcessOutput`) to encapsulate child processes and let them run as `Promises` or `Obervable`s (since `v1.8.0`).
* __Resolve__ - a class containing helpers to determine types of variables and to resolve functions and `Promise`s to values of any type (since `v2.6.0`).
* __ManualScheduler__ and __ManualSchedule__ provide mechanisms that align with the scheduler-concept and allow to trigger events manually (since `v2.7.0`).
* __Collection__, __Queue__, __ConstrainedQueue__ (a queue with limited size), __Stack__ and __LinkedList__\*/__LinkedListNode__\* provide fully tested collections that are often needed in JavaScript (since `v2.9.0`/\*`v2.10.0`)
* __Dictionary__ and __Cache__ (which extends it) are fully generic dictionaries that support strings and `Symbol`s as keys. __Cache__ is a capacity-constrained dictionary that supports eviction-policies such as `LRU/MRU`, `LFU/MFU`, `FIFO/LIFO` etc. Also, it supports eviction based on an optional timeout per value (like a weak map) (since `v2.21.0`; both are deprecated, use __DictionaryMapBased__ and __CacheMapBased__ instead as of `v2.22.0`)
* __CacheWithLoad__, an extension of __CacheMapBased__ that introduces a second concept of size constrainment based on a load (since `v2.22.0`).
* __EqualityComparer__ and __DefaultEqualityComparer__ are used within the *collections* to provide default- and custom-capabilities for comparing items (since `v2.9.0`)
* __Comparer__ and __DefaultComparer__ to equate items in terms of size (e.g. for sorting) (since `v2.10.0`)
* __formatValue__, __formatError__, __wrapError__ and __throwError__ are the first of new tools for values and Errors (since `v2.19.0`)
