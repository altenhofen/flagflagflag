create table if not exists "feature_flag" (
  "name" text not null primary key,
  "enabled" boolean not null
);
