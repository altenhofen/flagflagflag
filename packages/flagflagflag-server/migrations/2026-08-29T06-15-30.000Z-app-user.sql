create table if not exists "app_user" (
  "id" text not null primary key,
  "username" text not null unique,
  "email" text not null unique,
  "name" text not null,
  "passwordHash" text not null
);
