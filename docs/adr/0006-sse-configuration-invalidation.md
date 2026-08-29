# Use SSE as configuration invalidation, not evaluation

Status: accepted

The server publishes a minimal Configuration Invalidation containing only an Environment identity and Configuration Version after the configuration transaction commits. The Node SDK uses the notification to invoke its existing configuration refresh path; it never evaluates remotely or treats the event as configuration data. The first implementation uses an in-process event stream, heartbeat messages, reconnection backoff, and fallback polling, accepting single-instance propagation until an external event bus is required.
