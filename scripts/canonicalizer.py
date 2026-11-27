import sys
import re

PHASE_B_INDEXED_COLUMNS = {
    'credit_note_number',
    'refund_id',
    'student_id',
    'enrollment_id',
    'invoice_number',
}

def quote_aware_normalize(expr, diag=False):
    if not expr:
        return ""
    pattern = r"(E'(?:\\.|''|[^'])*'|e'(?:\\.|''|[^'])*'|'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\")"
    tokens = re.split(pattern, expr)

    if diag:
        print(f"canonicalizer input repr: {repr(expr)}", file=sys.stderr)

    btrim_matched_any = False
    literal_token_repr = None
    ws_recog_result = False

    # Narrowly scoped check for btrim(<phase_b_column>, <literal>) followed by closing ')'
    for i in range(0, len(tokens) - 2, 2):
        code_frag = tokens[i]
        match = re.search(r'\bbtrim\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*$', code_frag, re.IGNORECASE)
        if match and match.group(1).lower() in PHASE_B_INDEXED_COLUMNS:
            next_code = tokens[i+2] if i + 2 < len(tokens) else ""
            if re.match(r'^\s*\)', next_code):
                btrim_matched_any = True
                arg_token = tokens[i+1]
                literal_token_repr = repr(arg_token)
                inner_e = arg_token[2:-1] if arg_token.startswith("E'") or arg_token.startswith("e'") else None
                inner_s = arg_token[1:-1] if arg_token.startswith("'") and arg_token.endswith("'") else None

                expected_ws_ctrl = " \t\n\r\x0c\x0b"
                expected_ws_escapes = r" \t\n\r\f\v"

                if inner_s == expected_ws_ctrl or inner_e == expected_ws_escapes:
                    ws_recog_result = True
                    tokens[i+1] = r"E' \t\n\r\f\v'"

    if diag:
        print(f"targeted btrim context match: {btrim_matched_any}", file=sys.stderr)
        print(f"literal token repr: {literal_token_repr}", file=sys.stderr)
        print(f"exact whitespace recognition result: {ws_recog_result}", file=sys.stderr)

    canonical_tokens = []
    for i, token in enumerate(tokens):
        if not token:
            continue
        if i % 2 == 1:
            canonical_tokens.append(token)
        else:
            code = token
            code = code.replace('!=', '<>')
            keywords = {'and', 'or', 'is', 'not', 'btrim', 'null'}
            code = re.sub(r'\b[a-zA-Z_][a-zA-Z0-9_]*\b', lambda m: m.group(0).upper() if m.group(0).lower() in keywords else m.group(0), code)
            code = re.sub(r'\s+', ' ', code)
            code = re.sub(r'\s*(<>|<=|>=|!=|[(),=<>]|\bAND\b|\bOR\b|\bIS\b|\bNOT\b)\s*', lambda m: f" {m.group(1).upper()} ", code, flags=re.IGNORECASE)
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
            if not stoken:
                continue
            if idx % 2 == 1:
                continue
            else:
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
    diag_mode = False
    args = sys.argv[1:]
    if '--diag' in args:
        diag_mode = True
        args.remove('--diag')
    if args:
        print(quote_aware_normalize(args[0], diag=diag_mode))
