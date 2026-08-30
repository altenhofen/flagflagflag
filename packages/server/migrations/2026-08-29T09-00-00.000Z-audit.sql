create table if not exists "audit_entry" (
  "id" text not null primary key,
  "projectId" text not null,
  "createdAt" datetime not null default current_timestamp,
  "actorId" text not null,
  "action" text not null,
  "resourceType" text not null,
  "resourceId" text not null,
  "environmentId" text,
  "summary" text not null,
  "before" text,
  "after" text
);
create index if not exists "idx_audit_project_created" on "audit_entry" ("projectId", "createdAt", "id");
create table if not exists "audit_retention" (
  "id" text not null primary key,
  "retentionDays" integer not null,
  "updatedAt" datetime not null default current_timestamp
);
