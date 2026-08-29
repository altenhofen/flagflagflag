# Keep SDK evaluation local with refresh as a separate concern

Status: accepted

The Node SDK evaluates against its Last-Known-Good Configuration synchronously in the application process; `isEnabled` and `evaluate` never perform network I/O. Configuration retrieval is asynchronous, conditional, single-flight, and defensive, with fallback polling providing eventual repair when delivery is unavailable. This keeps flag checks predictable on request paths while retaining correctness across configuration failures.
