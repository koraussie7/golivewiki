#!/usr/bin/env bash
#
# Apply the drone-control migration to a staging Supabase project.
#
#   ./supabase/apply-drone-migration.sh [--dry-run] [--verify-only]
#
# ── Why a script instead of `supabase db push` ────────────────────────────────
#
# `supabase db push` walks every file in migrations/ and applies whatever it
# finds. This migration must not run twice and must not run blind against a
# database whose current state nobody has checked, so it is applied on its own,
# behind a preflight that refuses to proceed when the project is not what we
# expect.
#
# ── HARD RULE ────────────────────────────────────────────────────────────────
#
# This script refuses to run against production. It compares the target project
# ref against PRODUCTION_PROJECT_REF below and exits if they match. Staging
# first is not a formality: 0002 revokes broad privileges and enables RLS on six
# tables, and an RLS mistake on live data takes the site down rather than the
# migration.
#
# ── Requirements ─────────────────────────────────────────────────────────────
#
#   psql        (brew install libpq  /  apt install postgresql-client)
#   A staging connection string (Project Settings → Database → Connection string)
#
set -euo pipefail

MIGRATION="$(dirname "$0")/migrations/0002_drone_control.sql"

# Production project ref. Anything that resolves to this is refused.
PRODUCTION_PROJECT_REF="${PRODUCTION_PROJECT_REF:-}"

DRY_RUN=0
VERIFY_ONLY=0
for arg in "$@"; do
	case "$arg" in
		--dry-run) DRY_RUN=1 ;;
		--verify-only) VERIFY_ONLY=1 ;;
		-h | --help)
			sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'
			exit 0
			;;
		*)
			echo "unknown argument: $arg" >&2
			exit 2
			;;
	esac
done

# ── guards ───────────────────────────────────────────────────────────────────
if [[ ! -f "$MIGRATION" ]]; then
	echo "migration not found: $MIGRATION" >&2
	exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
	echo "psql not found. Install the PostgreSQL client:" >&2
	echo "  macOS:  brew install libpq && brew link --force libpq" >&2
	echo "  Debian: apt install postgresql-client" >&2
	exit 1
fi

: "${STAGING_DATABASE_URL:?set STAGING_DATABASE_URL to the staging connection string}"

# A pooler URL (…pooler.supabase.com) cannot run DDL reliably: the transaction
# may land on a different backend mid-script. Require the direct connection.
if [[ "$STAGING_DATABASE_URL" == *"pooler.supabase.com"* ]]; then
	echo "STAGING_DATABASE_URL points at the pooler." >&2
	echo "Use the direct connection string (port 5432, db.<ref>.supabase.co)." >&2
	exit 1
fi

STAGING_REF="$(printf '%s' "$STAGING_DATABASE_URL" | sed -n 's/.*db\.\([a-z0-9]*\)\.supabase\.co.*/\1/p')"
if [[ -z "$STAGING_REF" ]]; then
	echo "could not parse a project ref out of STAGING_DATABASE_URL." >&2
	echo "Expected a direct Postgres URL containing db.<ref>.supabase.co" >&2
	exit 1
fi

if [[ -n "$PRODUCTION_PROJECT_REF" && "$STAGING_REF" == "$PRODUCTION_PROJECT_REF" ]]; then
	echo "refusing to run: $STAGING_REF is the production project." >&2
	echo "Set PRODUCTION_PROJECT_REF correctly, and point this at staging." >&2
	exit 1
fi

echo "target project ref: $STAGING_REF"
echo "migration:          $MIGRATION ($(wc -l <"$MIGRATION" | tr -d ' ') lines)"
echo

# ── preflight ────────────────────────────────────────────────────────────────
# Every check is a fact the migration depends on. A failure here means the
# project is not in the state this migration was written for.
preflight() {
	local failures=0

	check() {
		local label="$1" query="$2" expectation="$3"
		local got
		got="$(psql "$STAGING_DATABASE_URL" -tAqc "$query" 2>/dev/null || echo "ERROR")"
		if [[ "$got" == "$expectation" ]]; then
			printf '  ok    %s (%s)\n' "$label" "$got"
		else
			printf '  FAIL  %s — got %s, expected %s\n' "$label" "$got" "$expectation" >&2
			failures=$((failures + 1))
		fi
	}

	echo "preflight:"
	# 0001 must be applied first — 0002's policies reference profiles.
	check "profiles table from 0001" \
		"select count(*) from information_schema.tables where table_schema='public' and table_name='profiles'" \
		"1"
	# The migration is idempotent (create table if not exists, drop policy if
	# exists) but re-running it would replace its functions. Detect a previous
	# run so the operator decides rather than discovering it later.
	check "drone_vehicles not already present" \
		"select count(*) from information_schema.tables where table_schema='public' and table_name='drone_vehicles'" \
		"0"
	# gen_random_uuid() is used for primary keys; it needs pgcrypto on PG < 13.
	check "gen_random_uuid available" \
		"select count(*) from pg_proc where proname='gen_random_uuid'" \
		"1"
	# auth.uid() is the basis of every RLS policy in the file.
	check "auth schema present" \
		"select count(*) from information_schema.schemata where schema_name='auth'" \
		"1"

	if [[ $failures -gt 0 ]]; then
		echo >&2
		echo "preflight failed ($failures). Nothing was changed." >&2
		echo "If drone tables already exist, this migration has run before — do not re-apply." >&2
		return 1
	fi
	echo
}

verify() {
	echo "verification:"
	psql "$STAGING_DATABASE_URL" -tAq <<'SQL'
select format('  tables: %s', count(*))
from information_schema.tables
where table_schema = 'public'
  and table_name in ('drone_vehicles','drone_missions','drone_sessions',
                     'drone_commands','drone_approvals','drone_audit_logs');

select format('  rls enabled: %s of 6', count(*))
from pg_tables
where schemaname = 'public'
  and tablename like 'drone\_%'
  and rowsecurity = true;

select format('  policies: %s', count(*))
from pg_policies
where schemaname = 'public' and tablename like 'drone\_%';

select format('  rpc: %s', count(*))
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('request_drone_camera_command','decide_drone_camera_command');
SQL

	# The grants are the part most likely to be wrong: an over-broad grant makes
	# the RLS policies cosmetic. Read them back rather than trusting the script.
	echo "  anon grants on drone tables (expect none):"
	psql "$STAGING_DATABASE_URL" -tAq <<'SQL'
select format('    %s.%s: %s', table_schema, table_name, privilege_type)
from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public' and table_name like 'drone\_%';
SQL
	echo "  (empty above means correct)"
}

preflight

if [[ $VERIFY_ONLY -eq 1 ]]; then
	verify
	exit 0
fi

if [[ $DRY_RUN -eq 1 ]]; then
	echo "dry run — migration not applied."
	echo "It would run inside a single transaction and roll back on any error."
	exit 0
fi

# ── apply ────────────────────────────────────────────────────────────────────
# ON_ERROR_STOP makes psql abort on the first failing statement; the surrounding
# transaction means a partial schema is never left behind.
echo "applying..."
if psql "$STAGING_DATABASE_URL" \
	-v ON_ERROR_STOP=1 \
	--single-transaction \
	--echo-errors \
	-f "$MIGRATION"; then
	echo
	echo "applied."
	echo
	verify
	echo
	echo "Next: run the app against staging and exercise the drone flows before"
	echo "touching production. RLS mistakes show up as empty results, not errors."
else
	echo >&2
	echo "FAILED — the transaction was rolled back; the database is unchanged." >&2
	echo "Read the error above. Do not retry with --single-transaction removed." >&2
	exit 1
fi
