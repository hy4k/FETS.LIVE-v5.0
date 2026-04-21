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
    openScheduleMenu: 'TODO_OPEN_SCHEDULE_MENU',
    scheduleLink: 'TODO_SCHEDULE_OR_BOOKINGS_LINK',
  },

  /**
   * Container that holds the Apr–Jun grid or list you scrape.
   * Prefer scoping all row queries under this root.
   */
  schedule: {
    root: 'TODO_SCHEDULE_ROOT',
    /** One locator per exam row (relative to root), or use getByRole loops in extractSchedule.mjs */
    row: 'TODO_EACH_SESSION_ROW',
    /** Optional: date cell within a row */
    dateCell: 'TODO_DATE_WITHIN_ROW',
    timeCell: 'TODO_TIME_WITHIN_ROW',
    bookedCountCell: 'TODO_BOOKED_COUNT_WITHIN_ROW',
    capacityCell: 'TODO_CAPACITY_WITHIN_ROW',
    testTypeCell: 'TODO_TEST_TYPE_WITHIN_ROW',
  },
}
