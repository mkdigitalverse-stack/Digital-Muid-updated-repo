import sys
import os

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../scripts")))
from canonicalizer import quote_aware_normalize

print("=== STARTING CANONICALIZER FINAL REGRESSION TEST SUITE ===")

preservation_tests = [
    r"E'it\'s valid'",
    r"'O''Reilly'",
    r"E'foo\\bar'",
    r"E'\t'",
    r"E'\\t'",
    r"'ordinary string'",
    r'"double_quoted_identifier"',
    r"E'\302\251'",
    r"E'\x41'",
    r"E'\u0041'",
    r"E'\U00000041'",
]

print("\n--- 1. String Preservation Tests ---")
for orig in preservation_tests:
    expr = f"(col = {orig})"
    norm = quote_aware_normalize(expr)
    expected_norm = f"col = {orig}"
    is_preserved = (norm == expected_norm)
    print(f"Input:    {repr(orig)}")
    print(f"Output:   {repr(norm)}")
    print(f"Preserved: {is_preserved}")
    print("-" * 50)
    assert is_preserved, f"Failed preservation test for {orig}: got {repr(norm)}"

print("\n--- 2. Tab vs Backslash-Tab Distinguishability ---")
t_tab = quote_aware_normalize(r"(col = E'\t')")
t_bs_tab = quote_aware_normalize(r"(col = E'\\t')")
print(f"E'\\t' normalized:   {repr(t_tab)}")
print(f"E'\\\\t' normalized: {repr(t_bs_tab)}")
assert t_tab != t_bs_tab, "E'\\t' and E'\\\\t' must remain distinct!"
print("Distinguishability test PASSED.")

print("\n--- 3. Phase B Whitespace Equivalence ---")
expected_pred = "(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')"
actual_pg_expr = "(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, ' \t\n\r\x0c\x0b') <> '')"

norm_expected = quote_aware_normalize(expected_pred)
norm_actual = quote_aware_normalize(actual_pg_expr)
print(f"Normalized Expected: {repr(norm_expected)}")
print(f"Normalized Actual:   {repr(norm_actual)}")
assert norm_expected == norm_actual, "Phase B whitespace representations must normalize identically!"
print("Phase B whitespace equivalence test PASSED.")

print("\n--- 4. Different Whitespace Sequences Remain Different ---")
ws_diff_1 = quote_aware_normalize(r"(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \t') <> '')")
ws_diff_2 = quote_aware_normalize(r"(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \t\n') <> '')")
assert ws_diff_1 != norm_expected, "Different whitespace sequences must not equal expected canonical"
assert ws_diff_2 != norm_expected, "Different whitespace sequences must not equal expected canonical"
print("Different whitespace distinction test PASSED.")

print("\n--- 5. Operator Normalization Tests ---")
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

print("\n--- 6. Negative Predicate Inequality Tests ---")
neg_tests = [
    (r"(credit_note_number IS NOT NULL) AND (btrim(credit_note_number, E' \t') <> '')", expected_pred),
    (r"(credit_note_number IS NULL) AND (btrim(credit_note_number, E' \t\\n\\r\\f\\v') <> '')", expected_pred),
]
for neg_expr, base_expr in neg_tests:
    norm_neg = quote_aware_normalize(neg_expr)
    norm_base = quote_aware_normalize(base_expr)
    assert norm_neg != norm_base, f"Negative test file failed: {neg_expr} should not equal {base_expr}"
    print(f"Negative test PASSED: {repr(neg_expr)} != {repr(base_expr)}")

print("\n=== ALL CANONICALIZER FINAL REGRESSION TESTS PASSED SUCCESSFULLY ===")
