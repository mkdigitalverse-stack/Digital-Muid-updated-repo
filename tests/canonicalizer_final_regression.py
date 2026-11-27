import sys
import os
import subprocess

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../scripts")))
from canonicalizer import quote_aware_normalize

print("=== STARTING CANONICALIZER & BASH PIPELINE REGRESSION TEST SUITE ===")

# 1. Exact Bash read + psql INDEX_META capture reproduction fixture
bash_test = r'''
INDEX_META=$(printf "public|public|btree|t|t|t|1|1|t|credit_note_number|((credit_note_number IS NOT NULL) AND (btrim(credit_note_number, ' \t\n\r\f\v') <> ''))")
IFS='|' read -r -d '' actual_idx_schema actual_tbl_schema actual_am actual_unique actual_valid actual_ready actual_nkeyatts actual_natts actual_no_expr actual_cols actual_pred <<< "$INDEX_META" || true
actual_pred="${actual_pred%$'\n'}"
col_name="credit_note_number"
EXPECTED_CANONICAL="(${col_name} IS NOT NULL) AND (btrim(${col_name}, E' \\t\\n\\r\\f\\v') <> '')"
python3 -c "import sys; print('captured predicate repr:', repr(sys.argv[1]))" "$actual_pred"
NORM_ACTUAL=$(python3 scripts/canonicalizer.py --diag "$actual_pred")
NORM_EXPECTED=$(python3 scripts/canonicalizer.py "$EXPECTED_CANONICAL")
python3 -c "import sys; print('normalized actual repr:', repr(sys.argv[1])); print('normalized expected repr:', repr(sys.argv[2]))" "$NORM_ACTUAL" "$NORM_EXPECTED"
if [ "$NORM_ACTUAL" != "$NORM_EXPECTED" ]; then
  echo "MISMATCH!"
  exit 1
fi
echo "BASH PIPELINE EXACT MATCH PASSED!"
'''
res = subprocess.run(["bash", "-c", bash_test], capture_output=True, text=True)
print(res.stdout, end="")
print(res.stderr, end="")
assert res.returncode == 0, f"Bash pipeline test failed with exit code {res.returncode}"

# 2. Exact Phase B predicate expected vs actual forms matching
expected_pred = "(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')"
actual_pg_expr = "((credit_note_number IS NOT NULL) AND (btrim(credit_note_number, ' \t\n\r\x0c\x0b') <> ''))"

norm_expected = quote_aware_normalize(expected_pred)
norm_actual = quote_aware_normalize(actual_pg_expr)
assert norm_expected == norm_actual, "Phase B expected and actual deparsed expressions must match!"
print("Phase B predicate match test PASSED.")

# 3. Same whitespace literal outside btrim remains unchanged
outside_ws_expr = "(credit_note_number IS NOT NULL) AND (credit_note_number = ' \t\n\r\x0c\x0b')"
norm_outside = quote_aware_normalize(outside_ws_expr)
assert "E'" not in norm_outside, "Whitespace literal outside btrim must not be normalized to E-string!"
print("Outside whitespace preservation test PASSED.")

# 4. Same literal inside btrim(other_column, ...) remains unchanged
other_col_expr = "(other_col IS NOT NULL) AND (btrim(other_col, ' \t\n\r\x0c\x0b') <> '')"
norm_other = quote_aware_normalize(other_col_expr)
assert "E'" not in norm_other, "Whitespace literal inside btrim(other_column, ...) must remain unchanged!"
print("Other column btrim preservation test PASSED.")

# 5. Targeted literal followed by an extra argument or operator is not normalized
extra_arg_expr = "(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, ' \t\n\r\x0c\x0b', 123) <> '')"
norm_extra = quote_aware_normalize(extra_arg_expr)
assert "E'" not in norm_extra, "Targeted literal with extra argument must not be normalized!"
print("Extra argument protection test PASSED.")

# 6. Different whitespace sequence does not match
ws_diff = quote_aware_normalize("(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t') <> '')")
assert ws_diff != norm_expected, "Different whitespace sequence must not equal expected canonical"
print("Different whitespace distinction test PASSED.")

# 7. IS NULL does not match
is_null_expr = "(credit_note_number IS NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')"
assert quote_aware_normalize(is_null_expr) != norm_expected, "IS NULL predicate must not equal IS NOT NULL predicate"
print("IS NULL negative test PASSED.")

# 8. Existing string-preservation cases still pass
preservation_tests = [
    r"E'it\'s valid'",
    r"'O''Reilly'",
    r"E'foo\\bar'",
    r"E'\t'",
    r"E'\\t'",
    r"'ordinary string'",
    r'"double_quoted_identifier"',
    r"E'\302\251'",
]
print("\n--- String Preservation Tests ---")
for orig in preservation_tests:
    expr = f"(col = {orig})"
    norm = quote_aware_normalize(expr)
    expected_norm = f"col = {orig}"
    is_preserved = (norm == expected_norm)
    print(f"Input:    {repr(orig)} -> Preserved: {is_preserved}")
    assert is_preserved, f"Failed preservation test for {orig}: got {repr(norm)}"

# 9. Operator Normalization Tests (<>, !=, <=, >=)
op_tests = [
    ("(a <> b)", "a <> b"),
    ("(a != b)", "a <> b"),
    ("(a <= b)", "a <= b"),
    ("(a >= b)", "a >= b"),
]
for expr, expected in op_tests:
    res = quote_aware_normalize(expr)
    assert res == expected, f"Operator test failed for {expr}: got {repr(res)}, expected {repr(expected)}"
    print(f"Operator test passed: {expr} -> {repr(res)}")

print("\n=== ALL CANONICALIZER & BASH PIPELINE REGRESSION TESTS PASSED SUCCESSFULLY ===")
