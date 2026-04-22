/**
 * Schedule grid selectors — fill from codegen after opening Schedule 📅.
 * Login uses getByRole in login.mjs.
 */

export const SELECTORS = {
  login: {
    /** Unused — login is in login.mjs via getByRole */
    usernameInput: 'UNUSED',
    passwordInput: 'UNUSED',
    submitButton: 'UNUSED',
  },

  /** Optional: use if home → Schedule flow changes; extractSchedule.mjs uses the Schedule link directly */
  nav: {
    openScheduleMenu: 'a[href*="schedule" i],button:has-text("Schedule")',
    scheduleLink: 'a[href*="schedule" i],a:has-text("Schedule"),button:has-text("Schedule")',
  },

  /**
   * Container that holds the Apr–Jun grid or list you scrape.
   * Prefer scoping all row queries under this root.
   */
  schedule: {
    root: 'main, .content-wrapper, [role="main"], .container-fluid',
    /** One locator per exam row (relative to root), or use getByRole loops in extractSchedule.mjs */
    row: 'tbody tr, [role="row"], .k-master-row, .mat-row',
    /** Optional: date cell within a row */
    dateCell: 'td:nth-child(1), [data-col*="date" i]',
    timeCell: 'td:nth-child(2), [data-col*="time" i]',
    bookedCountCell: 'td:has-text("/"), [data-col*="booked" i]',
    capacityCell: 'td:has-text("/"), [data-col*="capacity" i]',
    testTypeCell: 'td:has-text("CELPIP"), [data-col*="test" i]',
  },
}
