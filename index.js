const Rx = require('rxjs')
, Observable = Rx.Observable
, { Job, JobEvent, JobQueue, JobQueueEvent, symbolRun, symbolDone, symbolFailed, symbolIdle
  } = require('./lib/JobQueue')
, { JobQueueCapabilities } = require('./lib/JobQueueCapabilities')
, { Progress, ProgressNumeric, symbolProgress } = require('./lib/Progress')
, { CalendarScheduler, Calendar, CalendarEventSimple, symbolCalendarEvent
  } = require('./lib/CalendarScheduler')
, { Scheduler } = require('./lib/Scheduler')
, { Schedule, ScheduleEvent } = require('./lib/Schedule')
, { Interval, IntervalEventSimple, IntervalScheduler, symbolIntervalEvent
  } = require('./lib/IntervalScheduler')
, { ManualSchedule, ManualScheduleEventSimple, ManualScheduler, symbolManualSchedulerEvent
  } = require('./lib/ManualScheduler')
, { ProcessResult, ProcessErrorResult, ProcessExit,
  ProcessOutput, ProcessWrapper, symbolProcessOutput } = require('./lib/ProcessWrapper')
, { defer, deferMocha, timeout} = require('./tools/Defer')
, { assertThrowsAsync } = require('./tools/AssertAsync')
, { deepCloneObject, mergeObjects } = require('./tools/Objects')
, { getRandomNumber } = require('./tools/Random')
, { Resolve } = require('./tools/Resolve')
, { createVEvent, createVCalendar, createEmptyCalendar
  } = require('./test/test_CalendarScheduler')
, docs = require('./docs');


module.exports = {
  Rx, Observable,
  Job, JobEvent, JobQueue, JobQueueEvent, symbolRun, symbolDone, symbolFailed, symbolIdle,
  JobQueueCapabilities,
  Progress, ProgressNumeric, symbolProgress,
  CalendarScheduler, Calendar, CalendarEventSimple, symbolCalendarEvent,
  Scheduler, Schedule, ScheduleEvent,
  Interval, IntervalEventSimple, IntervalScheduler, symbolIntervalEvent,
  ManualSchedule, ManualScheduleEventSimple, ManualScheduler, symbolManualSchedulerEvent,
  ProcessResult, ProcessErrorResult, ProcessExit,
  ProcessOutput, ProcessWrapper, symbolProcessOutput,
  defer, deferMocha, timeout,
  assertThrowsAsync,
  deepCloneObject, mergeObjects,
  getRandomNumber,
  Resolve,
  createVEvent, createVCalendar, createEmptyCalendar,
  docs
};
