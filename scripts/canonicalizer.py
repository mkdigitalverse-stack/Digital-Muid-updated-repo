import sys
import re


def normalize_string_literal(token):
    """Normalize only the exact Phase B btrim whitespace argument."""
    if token in ("E' \\t\\n\\r\\f\\v'", "e' \\t\\n\\r\\f\\v'"):
        return "E' \\t\\n\\r\\f\\v'"

    if token.startswith("'") and token.endswith("'"):
        inner = token[1:-1]
        if inner == " \t\n\r\x0c\x0b":
            return "E' \\t\\n\\r\\f\\v'"

    return token


def quote_aware_normalize(expr):
    """Normalize harmless formatting and PostgreSQL's casts on string literals.

    PostgreSQL pg_get_expr() can render unknown string constants as
    'value'::text. Removing that cast is safe for a string literal, while
    casts on identifiers/columns (for example column_name::text) remain
    significant and are deliberately preserved.
    """
    if not expr:
        return ""

    pattern = r"""(E'(?:\\.|''|[^'])*'|e'(?:\\.|''|[^'])*'|'(?:''|[^'])*'|"(?:""|[^"])*")"""
    tokens = re.split(pattern, expr)
    canonical_tokens = []
    previous_was_string_literal = False

    for i, token in enumerate(tokens):
        if not token:
            continue

        if i % 2 == 1:
            canonical_tokens.append(normalize_string_literal(token))
            previous_was_string_literal = True
            continue

        code = token
        if previous_was_string_literal:
            # Only strip a direct ::text cast attached to the preceding
            # quoted literal. Do not strip casts from columns or expressions.
            code = re.sub(r"^(\s*)::\s*text\b", r"\1", code, count=1, flags=re.IGNORECASE)
        previous_was_string_literal = False

        code = code.replace('!=', '<>')
        keywords = {'and', 'or', 'is', 'not', 'btrim', 'null'}
        code = re.sub(
            r'\b[a-zA-Z_][a-zA-Z0-9_]*\b',
            lambda m: m.group(0).upper()
            if m.group(0).lower() in keywords else m.group(0),
            code
        )
        code = re.sub(r'\s+', ' ', code)
        code = re.sub(
            r'\s*(<>|<=|>=|!=|[(),=<>]|\bAND\b|\bOR\b|\bIS\b|\bNOT\b)\s*',
            lambda m: f" {m.group(1).upper()} ",
            code,
            flags=re.IGNORECASE
        )
        code = re.sub(r'\s+', ' ', code)
        canonical_tokens.append(code)

    reconstructed = "".join(canonical_tokens).strip()
    s = reconstructed
    while s.startswith('(') and s.endswith(')'):
        sub_str = s[1:-1]
        sub_tokens = re.split(pattern, sub_str)
        current_depth = 0
        valid_balance = True
        for idx, stoken in enumerate(sub_tokens):
            if not stoken or idx % 2 == 1:
                continue
            for char in stoken:
                if char == '(':
                    current_depth += 1
                elif char == ')':
                    current_depth -= 1
                    if current_depth < 0:
                        valid_balance = False
                        break
            if not valid_balance:
                break
        if valid_balance and current_depth == 0:
            s = sub_str.strip()
        else:
            break

    return s.strip()


if __name__ == '__main__':
    if len(sys.argv) > 1:
        print(quote_aware_normalize(sys.argv[1]))
