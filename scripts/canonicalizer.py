import sys
import re

def quote_aware_normalize(expr):
    if not expr:
        return ""
    pattern = r"(E'(?:\\.|''|[^'])*'|e'(?:\\.|''|[^'])*'|'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\")"
    tokens = re.split(pattern, expr)
    
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
            code = re.sub(r'\s*([(),=<>]|\bAND\b|\bOR\b|\bIS\b|\bNOT\b)\s*', lambda m: f" {m.group(1).upper()} ", code, flags=re.IGNORECASE)
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
    if len(sys.argv) > 1:
        print(quote_aware_normalize(sys.argv[1]))
