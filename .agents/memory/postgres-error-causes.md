---
name: PostgreSQL constraint error causes
description: The Drizzle/PostgreSQL runtime may wrap driver error codes in nested causes.
---

When translating PostgreSQL constraint violations into HTTP responses, inspect a short, bounded chain of `cause` objects rather than checking only the top-level error.

**Why:** Duplicate enrollment first surfaced as a 500 because PostgreSQL's `23505` code was nested on the cause in this workspace.

**How to apply:** Reuse the safe constraint-error helper for unique/FK conflict responses, and log only the SQL code rather than the query or submitted record.
