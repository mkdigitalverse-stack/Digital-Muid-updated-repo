path = 'scripts/verify_phase_b.sh'
with open(path, 'r') as f:
    content = f.read()

start_idx = content.find('# --- Offline Unit Test Suite using shared canonicalizer ---')
end_idx = content.find('MIGRATION_FILE="supabase/migrations/20261107000002_concurrent_indexes.sql"')

if start_idx != -1 and end_idx != -1:
    new_python_block = """# --- Offline Unit Test Suite using shared canonicalizer ---
python3 - << 'EOF'
import sys
import os
sys.path.insert(0, 'scripts')
from canonicalizer import quote_aware_normalize

print("=== LOCAL PREDICATE CANONICALIZER UNIT TESTS (Offline Python Test Suite) ===")

test_cases = [
    # 1. Correct predicate with explicit E-string and uppercase
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') <> '')", True),
    # 2. Correct predicate with lowercase 'and' and repeated spaces outside quotes
    ("  (credit_note_number   is   not   null)   and   (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') <> '')  ", True),
    # 3. Equivalent redundant parentheses (double outer parens)
    ("(((credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') <> '')))", True),
    # 4. != versus <> representation
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') != '')", True),
    # 5. PostgreSQL-style BTRIM whitespace argument matching canonical E-string form
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') != '')", True),
    # 6. Multi-character operators preservation (<>, <=, >=)
    ("(credit_note_number <> '') AND (amount <= 100) AND (amount >= 10)", False),
    # 7. Negative test: expressions with ::text remain distinguishable from without ::text
    ("(credit_note_number::text IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') <> '')", False),
    # 8. Negative test: different string literal contents remain different
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t') <> '')", False),
    # 9. Test for parentheses inside string literal (negative test against canonical target)
    ("(credit_note_number = '(parentheses inside string)') AND (credit_note_number IS NOT NULL)", False),
    # 10. Test for doubled quotes / escaped apostrophes (negative test against canonical target)
    ("(credit_note_number = 'O''Reilly') AND (credit_note_number IS NOT NULL)", False),
    # 11. Test for E-string escaped quotes and backslashes (negative test against canonical target)
    ("(credit_note_number = E'foo\\\\'bar') AND (credit_note_number IS NOT NULL)", False),
    # 12. Ordinary string literals remain byte-for-byte unchanged
    ("(credit_note_number = 'ordinary string') AND (credit_note_number IS NOT NULL)", False),
    # 13. Incorrect: added OR condition
    ("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\\\t\\\\n\\\\r\\\\f\\\\v') <> '') OR 1=1", False),
]

canonical_target = quote_aware_normalize("(col IS NOT NULL) AND (btrim(col, E' \\\\t\\\\n\\\\r\\\\f\\\\v') <> '')")
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
"""
    content = content[:start_idx] + new_python_block + '\n' + content[end_idx:]
    with open(path, 'w') as f:
        f.write(content)
    print('SUCCESS')
else:
    print('INDICES NOT FOUND')
