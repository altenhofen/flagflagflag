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
  "name" text not null,
  "environmentId" text not null references "environment" ("id") on delete cascade,
  "enabled" boolean not null default false,
  primary key ("name", "environmentId")
);

drop table "feature_flag";
alter table "feature_flag_normalized" rename to "feature_flag";