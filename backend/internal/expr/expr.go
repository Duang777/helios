package expr

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

type Scope struct {
	Params map[string]any
	Vars   map[string]any
}

var placeholderRE = regexp.MustCompile(`\$\{([^}]+)\}`)

func EvalString(template string, scope Scope) (string, error) {
	var firstErr error
	out := placeholderRE.ReplaceAllStringFunc(template, func(match string) string {
		if firstErr != nil {
			return ""
		}
		path := match[2 : len(match)-1]
		val, err := lookup(path, scope)
		if err != nil {
			firstErr = err
			return ""
		}
		s, err := stringify(val)
		if err != nil {
			firstErr = err
			return ""
		}
		return s
	})
	if firstErr != nil {
		return "", firstErr
	}
	return out, nil
}

func EvalBool(expr string, scope Scope) (bool, error) {
	expr = strings.TrimSpace(expr)
	if expr == "" || expr == "true" {
		return expr == "true" || expr == "", nil
	}
	if expr == "false" {
		return false, nil
	}

	if strings.Contains(expr, "==") {
		left, right, ok := splitOnce(expr, "==")
		if !ok {
			return false, fmt.Errorf("invalid == expression: %q", expr)
		}
		lv, err := evalOperand(strings.TrimSpace(left), scope)
		if err != nil {
			return false, err
		}
		rv, err := evalOperand(strings.TrimSpace(right), scope)
		if err != nil {
			return false, err
		}
		return equalAny(lv, rv), nil
	}

	if strings.Contains(expr, "!=") {
		left, right, ok := splitOnce(expr, "!=")
		if !ok {
			return false, fmt.Errorf("invalid != expression: %q", expr)
		}
		lv, err := evalOperand(strings.TrimSpace(left), scope)
		if err != nil {
			return false, err
		}
		rv, err := evalOperand(strings.TrimSpace(right), scope)
		if err != nil {
			return false, err
		}
		return !equalAny(lv, rv), nil
	}

	return false, fmt.Errorf("unsupported when expression: %q", expr)
}

func evalOperand(raw string, scope Scope) (any, error) {
	if strings.HasPrefix(raw, "${") && strings.HasSuffix(raw, "}") {
		return lookup(raw[2:len(raw)-1], scope)
	}
	if raw == "true" {
		return true, nil
	}
	if raw == "false" {
		return false, nil
	}
	if raw == `""` {
		return "", nil
	}
	if strings.HasPrefix(raw, `"`) && strings.HasSuffix(raw, `"`) {
		return raw[1 : len(raw)-1], nil
	}
	if n, err := strconv.ParseFloat(raw, 64); err == nil {
		return n, nil
	}
	return raw, nil
}

func lookup(path string, scope Scope) (any, error) {
	parts := strings.Split(path, ".")
	if len(parts) == 0 || parts[0] == "" {
		return nil, fmt.Errorf("empty expression path")
	}

	var cur any
	switch parts[0] {
	case "params":
		if len(parts) < 2 {
			return nil, fmt.Errorf("params path requires a key")
		}
		if scope.Params == nil {
			return nil, fmt.Errorf("unknown params.%s", parts[1])
		}
		v, ok := scope.Params[parts[1]]
		if !ok {
			return nil, fmt.Errorf("unknown params.%s", parts[1])
		}
		cur = v
		parts = parts[2:]
	default:
		if scope.Vars == nil {
			return nil, fmt.Errorf("unknown %s", parts[0])
		}
		v, ok := scope.Vars[parts[0]]
		if !ok {
			return nil, fmt.Errorf("unknown %s", parts[0])
		}
		cur = v
		parts = parts[1:]
	}

	for _, p := range parts {
		m, ok := asMap(cur)
		if !ok {
			return nil, fmt.Errorf("cannot read field %q on non-object", p)
		}
		next, ok := m[p]
		if !ok {
			return nil, fmt.Errorf("unknown field %q", p)
		}
		cur = next
	}
	return cur, nil
}

func asMap(v any) (map[string]any, bool) {
	switch t := v.(type) {
	case map[string]any:
		return t, true
	default:
		return nil, false
	}
}

func stringify(v any) (string, error) {
	switch t := v.(type) {
	case nil:
		return "", nil
	case string:
		return t, nil
	case bool:
		return strconv.FormatBool(t), nil
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64), nil
	case int:
		return strconv.Itoa(t), nil
	case json.Number:
		return t.String(), nil
	default:
		b, err := json.Marshal(t)
		if err != nil {
			return "", err
		}
		return string(b), nil
	}
}

func equalAny(a, b any) bool {
	as, errA := stringify(a)
	bs, errB := stringify(b)
	if errA != nil || errB != nil {
		return false
	}
	if ab, ok := a.(bool); ok {
		if bb, ok := b.(bool); ok {
			return ab == bb
		}
	}
	return as == bs
}

func splitOnce(s, sep string) (string, string, bool) {
	i := strings.Index(s, sep)
	if i < 0 {
		return "", "", false
	}
	return s[:i], s[i+len(sep):], true
}
