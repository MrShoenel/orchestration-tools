# OrchestrationTools

[![Greenkeeper badge](https://badges.greenkeeper.io/MrShoenel/orchestration-tools.svg)](https://greenkeeper.io/)
Collection of `orchestratrion-tools` that help building an infrastructure or to orchestrate resources through NodeJS.

## Current list of included tools
* __Job__ - a class that can encapsulate and represent any (asynchronous) work. Supports `Promise`-based work, enhanced states, simple eventing and progress.
* __JobQueue__ - a queue that supports parallel jobs with free degree of parallelism.
* __JobWithCost__ - an extension to `Job` which defines the cost to execute this job. This kind of job should be used with a compatible queue.
* __JobQueueCapabilities__ - an extension to the `JobQueue` that can manage and run jobs based on their cost, rather than on plain parallelism.
* __Progress__ - a class used to report any kind of (generic) progress. Supports callbacks, events and `Observables` through `RxJS`.
* __ProgressNumeric__ - an extension (and simplification) of `Progress` especially for numeric progress.
* __CalendarScheduler__ and __Calendar__ provide mechanism to schedule jobs based on `iCal`-calendars from any source (new in `v1.4.0`).

## Build Status
__`Master`__-branch: [![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master)](https://travis-ci.org/MrShoenel/orchestration-tools)
