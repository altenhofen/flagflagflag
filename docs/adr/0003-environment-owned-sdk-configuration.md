# Make environments the configuration boundary

Status: accepted

An Environment owns the effective Feature Flag state exposed to SDK consumers, and every SDK Key resolves to exactly one Environment. SDK Configuration is a complete snapshot for that boundary, identified by the Environment's Configuration Version and protected by conditional retrieval. This keeps staging and production isolated, makes cache replacement atomic at the consumer boundary, and avoids assembling configuration from multiple cross-environment sources.
