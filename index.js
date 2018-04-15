const Rx = require('rxjs')
, Observable = Rx.Observable
, { Job, JobQueue, symbolRun, symbolDone, symbolFailed
  } = require('./lib/JobQueue')
, { JobWithCost, JobQueueCapabilities } = require('./lib/JobQueueCapabilities')
, { Progress, ProgressNumeric, symbolProgress } = require('./lib/Progress')
, { CalendarScheduler, Calendar, CalendarEventSimple, symbolCalendarEvent
  } = require('./lib/CalendarScheduler')
, { Scheduler } = require('./lib/Scheduler')
, { Schedule, ScheduleEvent } = require('./lib/Schedule')
, { Interval, IntervalEventSimple, IntervalScheduler, symbolIntervalEvent
  } = require('./lib/IntervalScheduler')
, { ProcessResult, ProcessErrorResult, ProcessExit,
  ProcessOutput, ProcessWrapper, symbolProcessOutput } = require('./lib/ProcessWrapper')
, { defer, deferMocha, timeout} = require('./tools/Defer')
, { assertThrowsAsync } = require('./tools/AssertAsync')
, { deepCloneObject, mergeObjects } = require('./tools/Objects')
, docs = require('./docs');

module.exports = {
  docs,
  Rx, Observable,
  Job, JobQueue, symbolRun, symbolDone, symbolFailed,
  JobWithCost, JobQueueCapabilities,
  Progress, ProgressNumeric, symbolProgress,
  CalendarScheduler, Calendar, CalendarEventSimple, symbolCalendarEvent,
  Scheduler, Schedule, ScheduleEvent,
  Interval, IntervalEventSimple, IntervalScheduler, symbolIntervalEvent,
  ProcessResult, ProcessErrorResult, ProcessExit,
  ProcessOutput, ProcessWrapper, symbolProcessOutput,
  defer, deferMocha, timeout,
  assertThrowsAsync,
  deepCloneObject, mergeObjects
};
