create extension if not exists pgcrypto;

create type public.paathshala_role as enum ('platform_admin', 'admin', 'teacher', 'parent', 'student');
create type public.membership_status as enum ('pending', 'active', 'suspended');
create type public.attendance_status as enum ('present', 'absent', 'excused');
create type public.event_status as enum ('draft', 'published', 'cancelled');