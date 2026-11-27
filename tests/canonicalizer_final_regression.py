
import sys
import os

sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "../scripts")
    )
)

from canonicalizer import quote_aware_normalize


print("=== STARTING CANONICALIZER FINAL REGRESSION TEST SUITE ===")


# 1. String preservation tests
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

    assert norm == expected_norm, (
        f"Failed preservation test for {orig}: "
        f"got {repr(norm)}"
    )

    print(f"PASS: {repr(orig)}")


# 2. Tab versus backslash-tab distinction
print("\n--- 2. Tab vs Backslash-Tab Distinguishability ---")

t_tab = quote_aware_normalize(r"(col = E'\t')")
t_bs_tab = quote_aware_normalize(r"(col = E'\\t')")

assert t_tab != t_bs_tab, (
    "E'\\t' and E'\\\\t' must remain distinct"
)

print("PASS: Tab and backslash-tab remain distinct")


# 3. Phase B whitespace equivalence
print("\n--- 3. Phase B Whitespace Equivalence ---")

expected_pred = (
    "(credit_note_number IS NOT NULL) "
    "AND (btrim(credit_note_number, E' \\t\\n\\r\\f\\v') <> '')"
)

actual_pg_expr = (
    "(credit_note_number IS NOT NULL) "
    "AND (btrim(credit_note_number, ' \t\n\r\x0c\x0b') <> '')"
)

norm_expected = quote_aware_normalize(expected_pred)
norm_actual = quote_aware_normalize(actual_pg_expr)

assert norm_expected == norm_actual, (
    "Phase B whitespace representations must normalize identically"
)

print("PASS: Phase B whitespace representations are equivalent")


# 4. Different whitespace sequences must remain different
print("\n--- 4. Different Whitespace Sequences ---")

ws_diff_1 = quote_aware_normalize(
    r"(credit_note_number IS NOT NULL) "
    r"AND (btrim(credit_note_number, E' \t') <> '')"
)

ws_diff_2 = quote_aware_normalize(
    r"(credit_note_number IS NOT NULL) "
    r"AND (btrim(credit_note_number, E' \t\n') <> '')"
)

assert ws_diff_1 != norm_expected
assert ws_diff_2 != norm_expected

print("PASS: Different whitespace sequences remain distinct")


# 5. Multi-character operator tests
print("\n--- 5. Operator Normalization Tests ---")

op_tests = [
    ("(a <> b)", "a <> b"),
    ("(a != b)", "a <> b"),
    ("(a <= b)", "a <= b"),
    ("(a >= b)", "a >= b"),
]

for expr, expected in op_tests:
    result = quote_aware_normalize(expr)

    assert result == expected, (
        f"Operator test failed for {expr}: "
        f"got {repr(result)}, expected {repr(expected)}"
    )

    print(f"PASS: {expr} -> {repr(result)}")


# 6. Negative predicate tests
print("\n--- 6. Negative Predicate Inequality Tests ---")

negative_tests = [
    (
        r"(credit_note_number IS NOT NULL) "
        r"AND (btrim(credit_note_number, E' \t') <> '')"
    ),
    (
        r"(credit_note_number IS NULL) "
        r"AND (btrim(credit_note_number, E' \t\n\r\f\v') <> '')"
    ),
]

for negative_expr in negative_tests:
    normalized_negative = quote_aware_normalize(negative_expr)

    assert normalized_negative != norm_expected, (
        f"Incorrectly accepted negative predicate: {negative_expr}"
    )

    print(f"PASS: Rejected incorrect predicate {repr(negative_expr)}")


print("\n=== ALL CANONICALIZER FINAL REGRESSION TESTS PASSED ===")
