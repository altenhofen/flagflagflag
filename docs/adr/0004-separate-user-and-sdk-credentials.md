# Separate user sessions from SDK keys

Status: accepted

User Sessions authenticate management and administrative actions; SDK Keys authenticate environment-scoped configuration access. They remain separate credential classes with separate lifecycles and exposure rules: user sessions may represent operators, while SDK Key secrets are stored only as hashes, returned once at creation, and revocable without granting management access. This limits the blast radius of a leaked runtime credential and keeps client responsibilities explicit.
