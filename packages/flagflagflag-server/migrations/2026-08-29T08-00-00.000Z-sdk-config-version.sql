create table if not exists "sdk_config_version" (
  "environmentId" text not null primary key,
  "version" integer not null,
  "fingerprint" text not null,
  foreign key ("environmentId") references "environment" ("id") on delete cascade
);
