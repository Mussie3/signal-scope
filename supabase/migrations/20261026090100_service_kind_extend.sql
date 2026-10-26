-- SignalScope :: service_kind gains 'frontend' and 'external'
--
-- Derived topologies produce node kinds the original enum never anticipated.
-- The demo seeds "Frontend" as kind 'api', which was always a fudge; once the
-- graph comes from real trace data, an entry point and a third-party dependency
-- are genuinely different things from an internal API:
--
--   frontend -- an entry point. Emits outbound calls, serves no inbound spans.
--               Its health is the user's experience, not a dependency's.
--   external -- something outside the blast radius. You cannot fix Stripe; you
--               can only see that it is degrading you, which changes how an
--               incident on it should read.
--
-- Deliberately its own migration: ALTER TYPE ... ADD VALUE may run inside a
-- transaction on modern Postgres, but the new value cannot be USED in that same
-- transaction. Keeping it separate means the next migration can reference these
-- values freely.

alter type public.service_kind add value if not exists 'frontend';
alter type public.service_kind add value if not exists 'external';
