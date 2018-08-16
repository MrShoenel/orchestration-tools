const { assert, expect } = require('chai')
, { timeout } = require('../tools/Defer')
, { assertThrowsAsync } = require('../tools/AssertAsync')
, { Calendar, CalendarScheduler } = require('../lib/CalendarScheduler')
, { Interval, IntervalScheduler} = require('../lib/IntervalScheduler')
, { ManualSchedule, ManualScheduler } = require('../lib/ManualScheduler')
, { Schedule } = require('../lib/Schedule')
, { Scheduler } = require('../lib/Scheduler');


describe('Scheduler', function() {
  it('should be partially abstract', done => {
    assert.throws(() => {
      const s = new Scheduler('foo');
      s.addSchedule(new Schedule());
    }, /abstract\smethod/i);

    assert.throws(() => {
      const s = new Scheduler('foo');
      s.removeSchedule(new Schedule());
    }, /abstract\smethod/i);

    assert.throws(() => {
      const s = new Scheduler('foo');
      s.hasSchedule(new Schedule());
    }, /abstract\smethod/i);

    assert.throws(() => {
      const s = new Scheduler('foo');
      s.removeAllSchedules();
    }, /abstract\smethod/i);

    done();
  });

  it('should work using the sync base-method for adding schedules', done => {
    const c = new CalendarScheduler()
    , i = new IntervalScheduler()
    , m = new ManualScheduler();

    const cs = new Calendar('asd', () => '')
    , is = new Interval(60)
    , ms = new ManualSchedule();

    assert.throws(() => c.addSchedule(is));
    assert.throws(() => i.addSchedule(ms));
    assert.throws(() => m.addSchedule(cs));

    assert.doesNotThrow(() => {
      c.addSchedule(cs);
      assert.isTrue(c.hasSchedule(cs));
      assert.isTrue(c.hasCalendar(cs));

      assert.throws(() => c.removeSchedule(is));
      c.removeSchedule(cs);
      assert.isFalse(c.hasSchedule(cs));
      assert.isFalse(c.hasCalendar(cs));
    });

    assert.doesNotThrow(() => {
      i.addSchedule(is);
      assert.isTrue(i.hasSchedule(is));
      assert.isTrue(i.hasInterval(is));
      
      assert.throws(() => i.removeSchedule(ms));
      i.removeSchedule(is);
      assert.isFalse(i.hasSchedule(is));
      assert.isFalse(i.hasInterval(is));
    });

    assert.doesNotThrow(() => {
      m.addSchedule(ms);
      assert.isTrue(m.hasSchedule(ms));
      assert.isTrue(m.hasManualSchedule(ms));

      assert.throws(() => m.removeSchedule(cs));
      m.removeSchedule(ms);
      assert.isFalse(m.hasSchedule(ms));
      assert.isFalse(m.hasManualSchedule(ms));
    });

    done();
  });
});