/* Local calendar calculations; no API or database calls. */
(() => {
  const addDays = (iso, n) => {
    const date = new Date(iso + 'T12:00:00');
    date.setDate(date.getDate() + n);
    return date.toISOString().slice(0, 10);
  };
  function dates({ start, end, cadence, weekdays = [], dayOfMonth }) {
    if (!['none', 'weekly', 'twice_weekly', 'monthly', 'custom'].includes(cadence)) return [];
    if (!start || !end || end < start) return [];
    if (cadence === 'none') return [start];
    const expected = cadence === 'weekly' ? 1 : cadence === 'twice_weekly' ? 2 : null;
    if (cadence !== 'monthly' && (!weekdays.length || expected && weekdays.length !== expected)) return [];
    if (cadence === 'monthly' && (!Number.isInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31)) return [];
    const result = [];
    for (let day = start; day <= end; day = addDays(day, 1)) {
      const date = new Date(day + 'T12:00:00');
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      if (cadence === 'monthly' ? date.getDate() === Math.min(dayOfMonth, lastDay) : weekdays.includes(date.getDay())) result.push(day);
      if (result.length > 52) return [];
    }
    return result;
  }
  function affected(classes, selected, scope) {
    return classes.filter(a => a.id === selected.id || selected.series && a.series === selected.series &&
      (scope === 'all' || scope === 'future' && (a.date + a.time) >= (selected.date + selected.time)));
  }
  globalThis.EcobellaRecurrence = { dates, affected, addDays };
})();
