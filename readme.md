# OrchestrationTools
Collection of `orchestratrion-tools` that help building an infrastructure or to orchestrate resources through NodeJS.

## Current list of included tools
* `Job` - a class that can encapsulate and represent work. Supports `Promise`-based work and simple eventing.
* `JobQueue` - a queue that supports parallel jobs with free degree of parallelism.
* `JobWithCost` - a extension to `Job` which defines the cost to execute this job. This kind of job should be used with a compatible queue.
* `JobQueueCapabilities` - an extension to the `JobQueue` that can manage and run jobs based on their cost, rather than on plain parallelism.

## Build Status
`Master`-branch: [![Build Status](https://api.travis-ci.org/MrShoenel/orchestration-tools.svg?branch=master)](https://travis-ci.org/MrShoenel/orchestration-tools)
