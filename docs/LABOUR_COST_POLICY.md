# Labour cost policy

- Labour is valued only from a farmer-configured employee, owner, or contractor hourly operational rate. FarmOS never inserts national-average wages.
- Owner labour is excluded unless an employee/rate version is explicitly marked `owner_estimate`.
- Rate versions have an effective-from date and optional effective-to date. A new rate closes the prior effective period; it does not modify old snapshots.
- Work orders may assign multiple employees. Planned and actual hours belong to each assignment.
- Completion freezes employee name, rate type, hours, hourly rate, effective date, currency, confidence, and total in `ActivityLabourCostSnapshot`.
- Missing hours or rate remains “Not recorded”. It is never treated as zero.
- Corrections and reversals use compensating economic entries and preserve the original snapshot/audit history.
