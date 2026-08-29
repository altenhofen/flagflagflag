create table if not exists "sdk_key" (
  "id" text not null primary key,
  "environmentId" text not null,
  "prefix" text not null,
  "keyHash" text not null unique,
  "createdAt" datetime not null,
  "revokedAt" datetime null,
  foreign key ("environmentId") references "environment" ("id") on delete cascade
);
