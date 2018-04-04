# OrchestrationTools
Collection of `orchestratrion-tools` that help building an infrastructure or to orchestrate resources through NodeJS.

## Current list of included tools
* __`Job`__ - a class that can encapsulate and represent any (asynchronous) work. Supports `Promise`-based work, enhanced states, simple eventing and progress.
* __`JobQueue`__ - a queue that supports parallel jobs with free degree of parallelism.
* __`JobWithCost`__ - an extension to `Job` which defines the cost to execute this job. This kind of job should be used with a compatible queue.
* __`JobQueueCapabilities`__ - an extension to the `JobQueue` that can manage and run jobs based on their cost, rather than on plain parallelism.
* __`Progress`__ - a class used to report any kind of (generic) progress. Supports callbacks, events and `Observables` through __RxJS__.
* __`ProgressNumeric`__ - an extension (and simplification) of `Progress` especially for numeric progress.

## Build Status
__`Master`__-branch: [![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master)](https://travis-ci.org/MrShoenel/orchestration-tools)
