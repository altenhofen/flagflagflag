create table "project" (
  "id" text not null primary key,
  "name" text not null unique
);

create table "environment" (
  "id" text not null primary key,
  "name" text not null,
  "projectId" text not null references "project" ("id") on delete cascade,
  unique ("projectId", "name")
);

create table "feature_flag_normalized" (
  "key" text not null,
  "environmentId" text not null references "environment" ("id") on delete cascade,
  "name" text not null,
  "enabled" boolean not null default false,
  "defaultValue" boolean not null default false,
  "rollout" text,
  "rules" text not null default '[]',
  "version" integer not null default 1,
  primary key ("key", "environmentId")
);

drop table "feature_flag";
alter table "feature_flag_normalized" rename to "feature_flag";