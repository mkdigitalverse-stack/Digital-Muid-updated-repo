#!/usr/bin/env bash
set -euo pipefail

echo "=== PHASE B LOCAL TEST HARNESS & RIGOROUS CATALOG VERIFICATION ==="

DB_URL="${1:-}"
if [ -z "$DB_URL" ]; then
  echo "ERROR: Database URL not provided."
  exit 1
fi

# Strict Loopback DB URL Validation & Port Matching against Supabase CLI status
if [[ ! "$DB_URL" =~ ^postgres(ql)?://([a-zA-Z0-9_.-]+):([^@]+)@(127\.0\.0\.1|localhost):([0-9]+)/([a-zA-Z0-9_.-]+)$ ]]; then
  echo "SAFETY ERROR: Database URL is null, malformed, or points to a non-loopback host. Aborting."
  exit 1
fi

DB_HOST="${BASH_REMATCH[4]}"
DB_PORT="${BASH_REMATCH[5]}"
DB_NAME="${BASH_REMATCH[6]}"
MASKED_URL="postgresql://***:***@$DB_HOST:$DB_PORT/$DB_NAME"

echo "Validated local loopback connection target: $MASKED_URL"

if ! command -v supabase &> /dev/null; then
  echo "FAIL-CLOSED ERROR: Supabase CLI is not available for full database target validation!"
  exit 1
fi

STATUS_JSON=$(supabase status --output json 2>/dev/null || echo "")
if [ -z "$STATUS_JSON" ] || [ "$STATUS_JSON" = "null" ]; then
  echo "FAIL-CLOSED ERROR: Could not obtain Supabase status JSON!"
  exit 1
fi

CLI_DB_URL=$(echo "$STATUS_JSON" | jq -r '.DB_URL // .LOCAL_DB_URL // empty')
if [ -z "$CLI_DB_URL" ] || [ "$CLI_DB_URL" = "null" ]; then
  echo "FAIL-CLOSED ERROR: Supabase status JSON does not contain DB_URL!"
  exit 1
fi

if [[ ! "$CLI_DB_URL" =~ ^postgres(ql)?://([a-zA-Z0-9_.-]+):([^@]+)@(127\.0\.0\.1|localhost):([0-9]+)/([a-zA-Z0-9_.-]+)$ ]]; then
  echo "FAIL-CLOSED ERROR: CLI status DB URL does not match loopback pattern!"
  exit 1
fi

CLI_HOST="${BASH_REMATCH[4]}"
CLI_PORT="${BASH_REMATCH[5]}"
CLI_NAME="${BASH_REMATCH[6]}"

if [ "$DB_HOST" != "$CLI_HOST" ] || [ "$DB_PORT" != "$CLI_PORT" ] || [ "$DB_NAME" != "$CLI_NAME" ]; then
  echo "FAIL-CLOSED ERROR: Supplied DB URL does not exactly match Supabase CLI status target!"
  exit 1
fi

echo "SUCCESS: Database target strictly validated against Supabase CLI status."

if [ ! -f "scripts/canonicalizer.py" ]; then
  echo "FAIL-CLOSED ERROR: Shared canonicalizer module scripts/canonicalizer.py not found!"
  exit 1
fi

# --- Offline Unit Test Suite using shared canonicalizer ---
python3 - << 'EOF'
import sys
import os
sys.path.insert(0, 'scripts')
from canonicalizer import quote_aware_normalize

print("=== LOCAL PREDICATE CANONICALIZER UNIT TESTS (Offline Python Test Suite) ===")

test_cases = [
    # 1. Correct predicate with explicit E-string and uppercase
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')", True),
    # 2. Correct predicate with lowercase 'and' and repeated spaces outside quotes
    ("  (credit_note_number   is   not   null)   and   (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')  ", True),
    # 3. Equivalent redundant parentheses (double outer parens)
    ("(((credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')))", True),
    # 4. != versus <> representation
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') != '')", True),
    # 5. Quoted-string preservation (interior whitespace in string preserved exact)
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')", True),
    # 6. Negative test: expressions with ::text remain distinguishable from without ::text
    ("(credit_note_number::text IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')", False),
    # 7. Negative test: different string literal contents remain different
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t') <> '')", False),
    # 8. Test for parentheses inside string literal (negative test against canonical target)
    ("(credit_note_number = '(parentheses inside string)') AND (credit_note_number IS NOT NULL)", False),
    # 9. Test for doubled quotes (negative test against canonical target)
    ("(credit_note_number = 'O''Reilly') AND (credit_note_number IS NOT NULL)", False),
    # 10. Test for E-string escaped quotes (negative test against canonical target)
    ("(credit_note_number = E'foo\\'bar') AND (credit_note_number IS NOT NULL)", False),
    # 11. Incorrect: added OR condition
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '') OR 1=1", False),
]

canonical_target = quote_aware_normalize("(col IS NOT NULL) AND (btrim(col, E' \\t\\n\\r\\f\\v') <> '')")

failed = False
for pred, should_pass in test_cases:
    test_target = pred.replace('credit_note_number', 'col')
    norm = quote_aware_normalize(test_target)
    passed = (norm == canonical_target)
    if passed != should_pass:
        print(f"LOCAL UNIT TEST FAILURE: Predicate '{pred}' resulted in pass={passed}, expected={should_pass}")
        print(f"  Normalized: '{norm}'")
        print(f"  Expected:   '{canonical_target}'")
        failed = True
    else:
        print(f"LOCAL UNIT TEST PASS: '{pred}' -> expected {should_pass}, got {passed}")

if failed:
    print("ERROR: Local predicate canonicalizer unit test matrix failed!")
    sys.exit(1)
print("=== LOCAL PREDICATE CANONICALIZER UNIT TESTS PASSED SUCCESSFULLY ===")
EOF

MIGRATION_FILE="supabase/migrations/20261107000002_concurrent_indexes.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
  echo "FAIL-CLOSED ERROR: Phase B migration file not found at $MIGRATION_FILE"
  exit 1
fi

echo "=== POSTGRESQL 17 RUNTIME CATALOG EVIDENCE & VERIFICATION (GitHub Actions / Supabase CLI Environment) ==="
echo "Executing Phase B concurrent indexes and preflight assertions via psql..."
psql "$DB_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
echo "Phase B execution completed successfully."

echo "Verifying exact schema ('public'), index count (exactly 1 row per index), access method, uniqueness, exact partial predicates, indisvalid, and indisready for all 8 indexes..."

EXPECTED_INDEXES=(
  "idx_credit_notes_number|public|credit_notes|t|credit_note_number|t"
  "idx_credit_notes_refund_id|public|credit_notes|t|refund_id|t"
  "idx_credit_notes_payment_id|public|credit_notes|f|payment_id|f"
  "idx_credit_notes_user_id|public|credit_notes|f|user_id|f"
  "idx_profiles_student_id|public|profiles|t|student_id|t"
  "idx_course_enrollments_enrollment_id|public|course_enrollments|t|enrollment_id|t"
  "idx_payments_invoice_number|public|payments|t|invoice_number|t"
  "idx_payments_credit_note_number|public|payments|t|credit_note_number|t"
)

for entry in "${EXPECTED_INDEXES[@]}"; do
  IFS='|' read -r idx_name schema_name table_name expected_unique col_name has_partial <<< "$entry"
  echo "----------------------------------------"
  echo "Validating index: $schema_name.$idx_name on $schema_name.$table_name (column: $col_name, unique: $expected_unique, partial: $has_partial)"

  ROW_COUNT=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c "
    SELECT count(*) 
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class t ON t.oid = i.indrelid
    WHERE c.relname = '$idx_name' AND n.nspname = '$schema_name' AND t.relname = '$table_name';
  ")

  if [ "$ROW_COUNT" != "1" ]; then
    echo "FAIL-CLOSED ERROR: Expected exactly 1 catalog entry for $schema_name.$idx_name, found $ROW_COUNT!"
    exit 1
  fi

  INDEX_META=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -F'|' -c "
    SELECT 
      n.nspname AS index_schema,
      t_n.nspname AS table_schema,
      am.amname,
      i.indisunique,
      i.indisvalid,
      i.indisready,
      i.indnkeyatts,
      i.indnatts,
      CASE WHEN i.indexprs IS NULL THEN 't' ELSE 'f' END AS no_expressions,
      (
        SELECT string_agg(att.attname, ',' ORDER BY ord)
        FROM unnest(i.indkey::smallint[]) WITH ORDINALITY AS k(attnum, ord)
        JOIN pg_attribute att ON att.attrelid = t.oid AND att.attnum = k.attnum
      ) AS indexed_cols,
      pg_catalog.pg_get_expr(i.indpred, i.indrelid) AS partial_pred
    FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace t_n ON t_n.oid = t.relnamespace
    JOIN pg_am am ON am.oid = c.relam
    WHERE c.relname = '$idx_name' AND n.nspname = '$schema_name' AND t.relname = '$table_name';
  ")

  IFS='|' read -r actual_idx_schema actual_tbl_schema actual_am actual_unique actual_valid actual_ready actual_nkeyatts actual_natts actual_no_expr actual_cols actual_pred <<< "$INDEX_META"

  if [ "$actual_idx_schema" != "public" ] || [ "$actual_tbl_schema" != "public" ]; then
    echo "ERROR: Index schema ($actual_idx_schema) or table schema ($actual_tbl_schema) is not 'public'."
    exit 1
  fi

  if [ "$actual_am" != "btree" ]; then
    echo "ERROR: Index $idx_name uses access method '$actual_am', expected 'btree'."
    exit 1
  fi

  if [ "$expected_unique" = "t" ] && [ "$actual_unique" != "t" ]; then
    echo "ERROR: Index $idx_name is expected to be unique but is non-unique."
    exit 1
  fi
  if [ "$expected_unique" = "f" ] && [ "$actual_unique" = "t" ]; then
    echo "ERROR: Index $idx_name is expected to be unique=false but is unique."
    exit 1
  fi

  if [ "$actual_valid" != "t" ] || [ "$actual_ready" != "t" ]; then
    echo "ERROR: Index $idx_name is invalid or not ready (indisvalid=$actual_valid, indisready=$actual_ready)."
    exit 1
  fi

  if [ "$actual_nkeyatts" != "1" ] || [ "$actual_natts" != "1" ] || [ "$actual_no_expr" != "t" ]; then
    echo "ERROR: Index $idx_name structural attribute/key count mismatch (nkeyatts=$actual_nkeyatts, natts=$actual_natts, no_expr=$actual_no_expr)."
    exit 1
  fi

  if [ "$actual_cols" != "$col_name" ]; then
    echo "ERROR: Index $idx_name indexes columns '$actual_cols', expected '$col_name'."
    exit 1
  fi

  if [ "$has_partial" = "t" ]; then
    if [ -z "$actual_pred" ]; then
      echo "ERROR: Index $idx_name is expected to be a partial index but has no predicate."
      exit 1
    fi
    
    EXPECTED_CANONICAL="(${col_name} IS NOT NULL) AND (btrim(${col_name}, E' \\t\\n\\r\\f\\v') <> '')"

    NORM_ACTUAL=$(python3 scripts/canonicalizer.py "$actual_pred")
    NORM_EXPECTED=$(python3 scripts/canonicalizer.py "$EXPECTED_CANONICAL")

    if [ "$NORM_ACTUAL" != "$NORM_EXPECTED" ]; then
      echo "ERROR: Index $idx_name exact partial predicate does not match canonical Phase B definition."
      echo "Normalized actual:   $NORM_ACTUAL"
      echo "Normalized expected: $NORM_EXPECTED"
      exit 1
    fi
  else
    if [ -n "$actual_pred" ]; then
      echo "ERROR: Index $idx_name is expected to be non-partial (indpred IS NULL) but has predicate: $actual_pred"
      exit 1
    fi
  fi

  echo "SUCCESS: Index $schema_name.$idx_name verified structurally and semantically against catalog metadata."
done

# Migration History Validation
echo "========================================"
echo "Validating migration history in schema_migrations..."
RECORDED_VERSIONS=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c "SELECT version FROM supabase_migrations.schema_migrations ORDER BY version;")

RECORDED_PHASE_A=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261107000001';")
if [ "$RECORDED_PHASE_A" != "20261107000001" ]; then
  echo "FAIL-CLOSED ERROR: Phase A migration version 20261107000001 is missing or mismatched in schema_migrations!"
  exit 1
fi

RECORDED_PHASE_B=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -t -A -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20261107000002';")
if [ -n "$RECORDED_PHASE_B" ]; then
  echo "FAIL-CLOSED ERROR: Phase B migration version 20261107000002 must remain unrecorded in schema_migrations during this test procedure!"
  exit 1
fi

echo "SUCCESS: Migration history validated (Phase A present, Phase B deliberately unrecorded)."
echo "=== PHASE B HARNESS VERIFICATION PASSED SUCCESSFULLY ==="
