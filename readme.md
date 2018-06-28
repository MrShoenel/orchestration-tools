| Master | Master-pre-v2.0.0 | Greenkeeper | Coverage |
|-|-|-|-|
|[![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master)](https://travis-ci.org/MrShoenel/orchestration-tools)|[![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master-pre-v2.0.0)](https://travis-ci.org/MrShoenel/orchestration-tools)|[![Greenkeeper badge](https://badges.greenkeeper.io/MrShoenel/orchestration-tools.svg)](https://greenkeeper.io/)|[![Coverage Status](https://coveralls.io/repos/github/MrShoenel/orchestration-tools/badge.svg?branch=develop)](https://coveralls.io/github/MrShoenel/orchestration-tools?branch=develop)|

___


# OrchestrationTools
Collection of `orchestration-tools` that help building an infrastructure or to orchestrate resources through NodeJS.

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
